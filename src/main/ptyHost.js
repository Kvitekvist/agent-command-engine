// TICKET-0019: dedicated forked process hosting node-pty sessions, ported
// from Flowgrid's ptyHost.js. Kept as its own process (not folded into the
// Electron main process) for two reasons: node-pty is a native module that
// would otherwise need an electron-rebuild step to load into Electron's own
// Node ABI, and a live interactive shell (with e.g. `claude` running inside
// it) must never go down just because something unrelated crashes in main.
const os = require('os')

let pty
try {
  pty = require('node-pty')
} catch (err) {
  pty = null
  console.error('[ptyHost] node-pty failed to load:', err.message)
}

const sessions = new Map() // id -> node-pty process
const exitWaiters = new Map() // id -> resolve fn, invoked once that session's onExit fires
const autoAnswerEnabled = new Map() // id -> boolean, whether to auto-answer permission prompts for this session
const autoAnswerState = new Map() // id -> { outputBuffer, lastAutoAnswerTime }, always populated regardless of enabled

function defaultShell() {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

// TICKET-0038 follow-up: the real Claude/Codex CLI permission prompt is not
// plain text like "Allow? (y/n)" (what the previous patterns below matched
// against) -- it's an Ink-rendered TUI menu, positioned with cursor-movement
// escape codes instead of literal spaces between words (e.g. the word gap in
// "Yes, I trust" is a raw `\x1b[1C` cursor-forward code, not a space
// character). Confirmed by capturing a real `claude` session's raw PTY
// output via node-pty directly: both the workspace-trust dialog and a real
// tool-permission prompt (WebFetch) render as
//   ❯ 1. Yes
//     2. Yes, and don't ask again for ...
//     3. No, and tell Claude what to do differently (esc)
// with "1. Yes" always the pre-selected default option. Plain regex against
// raw chunks can never match this -- the words are interleaved with escape
// codes -- so stripAnsi() below reconstructs approximate visible text
// (cursor-forward -> space, cursor-absolute-position -> newline, every other
// CSI/OSC sequence dropped) before pattern matching.
function stripAnsi(s) {
  return s
    .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences (window title, etc.)
    .replace(/\x1b\[[0-9;]*[Hf]/g, '\n') // cursor absolute position -> new row
    .replace(/\x1b\[[0-9]*C/g, ' ') // cursor forward N cols -> word gap
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // remaining CSI sequences (color, show/hide cursor, etc.)
    .replace(/\x1b[>=]/g, '')
}

// TICKET-0039: matching the literal word "Yes" was one real bug behind this
// ticket (see the ❯ + wording history below), but broadening to "any text
// after ❯ 1." still failed live in the actual app for the exact "Yes"
// prompt TICKET-0038 originally tested. Root-caused via file-based debug
// logging read directly from a live, user-reproduced session
// (~/ace-auto-answer-debug.log): the real captured tail was
//   "               > 1. Yes\n   2. Yes, and don't ask again..."
// -- a plain ASCII ">" (U+003E), not the fancy Unicode "❯" (U+276F) arrow
// this pattern required. Other Unicode in the same buffer (spinner glyphs,
// box-drawing characters) rendered fine, so this isn't a blanket encoding
// problem -- it's specifically Ink's SelectInput indicator choosing an
// ASCII fallback in the real Electron-forked ptyHost process's spawn
// environment, where a standalone test harness spawning the same CLI
// directly (used to diagnose the "Yes" vs "Allow" wording bug below) got
// the fancy glyph. Rather than chase the exact terminal-capability check
// Ink's SelectInput runs (fragile, could change across CLI versions),
// matching both glyphs sidesteps the question entirely.
//
// Original history: the ❯/❯-plus-"Yes" reasoning is still correct as far
// as it goes -- it's Ink's SelectInput component marking the currently-
// highlighted option, not something the assistant's own prose emits, and
// option 1 is consistently the pre-selected, least-destructive choice
// (confirmed against "Yes"/"No" and "Allow"/"Deny"). Hardcoding one word
// ("Yes", inherited from TICKET-0038) was the same mistake TICKET-0038
// itself diagnosed in the pre-0038 version, just one level deeper -- found
// live via a harness that forks this exact file and drives a real `claude`
// session: asking an agent to fetch yr.no weather led it to a browser tool
// instead of WebFetch, whose prompt read "❯ 1. Allow / 2. Deny (esc)", not
// "Yes". Matching the marker structurally (any text after "1.") fixed
// that, but not the ❯-vs-> rendering gap found afterward.
const PERMISSION_PROMPT_PATTERN = /[❯>]\s*1\.\s*\S/

// TICKET-0039: TICKET-0038's detection pattern (above) was correct, but the
// setting was only ever read once, at spawn time (AgentTerminal.jsx), and
// baked into a session for its whole lifetime. Toggling auto-answer on
// while an agent is *already* sitting on a prompt -- exactly the situation
// a user hits the toggle to fix -- did nothing until the agent was stopped
// and relaunched. So the buffer is now always accumulated (cheap: just a
// string append) regardless of whether auto-answer is enabled, and
// setAutoAnswer() below can act on it immediately the moment it's turned
// on, instead of waiting for the next chunk of CLI output that may never
// come if the prompt is just sitting there idle.
const MAX_AUTO_ANSWER_RETRIES = 2
const AUTO_ANSWER_RETRY_DELAY_MS = 600

function getAutoAnswerState(id) {
  let state = autoAnswerState.get(id)
  if (!state) {
    state = { outputBuffer: '', lastAutoAnswerTime: 0 }
    autoAnswerState.set(id, state)
  }
  return state
}

// Sends Enter to confirm the pre-selected "1. Yes" option, then re-checks
// the buffer a bit later -- if the same prompt marker is still showing,
// the keystroke likely didn't land (dropped by ConPTY, CLI mid-render,
// etc.) and it's resent, up to MAX_AUTO_ANSWER_RETRIES times. Without this,
// a single dropped keystroke leaves the prompt hanging exactly as if
// detection had never fired at all -- indistinguishable from the bug this
// ticket exists to fix.
function respondAndVerify(id, retriesLeft) {
  const proc = sessions.get(id)
  if (!proc) return
  proc.write('\r')
  if (retriesLeft <= 0) return
  setTimeout(() => {
    if (!autoAnswerEnabled.get(id)) return
    const state = autoAnswerState.get(id)
    if (state && PERMISSION_PROMPT_PATTERN.test(stripAnsi(state.outputBuffer))) {
      respondAndVerify(id, retriesLeft - 1)
      state.outputBuffer = ''
    }
  }, AUTO_ANSWER_RETRY_DELAY_MS)
}

// Called on every chunk of PTY output (buffer already updated by the
// caller) and also directly from setAutoAnswer() when auto-answer is
// switched on mid-session, so it can act on a prompt that's already fully
// rendered on screen instead of waiting for new output that may never come.
function maybeAutoAnswer(id) {
  if (!autoAnswerEnabled.get(id)) return
  const state = getAutoAnswerState(id)
  const now = Date.now()
  const hasPrompt = PERMISSION_PROMPT_PATTERN.test(stripAnsi(state.outputBuffer))

  // Auto-respond if: prompt detected AND enough time passed since last auto-answer (debounce)
  if (hasPrompt && now - state.lastAutoAnswerTime > 200) {
    state.lastAutoAnswerTime = now
    // Small delay to let the prompt fully render before responding
    setTimeout(() => respondAndVerify(id, MAX_AUTO_ANSWER_RETRIES), 100)
    // Clear buffer after auto-answer so we don't match the same prompt twice
    state.outputBuffer = ''
  }
}

// TICKET-0039: lets the renderer flip auto-answer on/off for a session
// that's already running, without a respawn -- see the comment above
// MAX_AUTO_ANSWER_RETRIES for why spawn-time-only was the actual bug.
function setAutoAnswer(id, enabled) {
  if (!sessions.has(id)) return
  if (enabled) {
    autoAnswerEnabled.set(id, true)
    maybeAutoAnswer(id) // act on a prompt that's already on screen right now
  } else {
    autoAnswerEnabled.delete(id)
  }
}

// TICKET-0039: auto-answer is never set at spawn time -- every session
// starts with it off (see AgentTerminal.jsx) and it's only ever turned on
// afterward via setAutoAnswer(), through the per-agent 🛡️ Auto-approve
// pill. Silently auto-confirming every permission prompt shouldn't be the
// default for a freshly launched agent.
function spawnSession({ id, shell, cwd, cols, rows }) {
  if (sessions.has(id)) {
    return { success: false, error: `Session ${id} already exists` }
  }
  if (!pty) {
    return { success: false, error: 'node-pty is not available' }
  }
  try {
    const proc = pty.spawn(shell || defaultShell(), [], {
      name: 'xterm-color',
      cols: cols > 0 ? cols : 80,
      rows: rows > 0 ? rows : 24,
      cwd: cwd || os.homedir(),
      env: process.env,
    })
    sessions.set(id, proc)
    getAutoAnswerState(id)

    proc.onData((chunk) => {
      // Raw rolling buffer to detect prompts split across chunks -- kept
      // larger than the old 500-char window since a full Ink redraw of a
      // permission box (workspace path, tool args, the menu itself) runs
      // well past that before stripping. Always maintained (not just while
      // enabled) so switching auto-answer on mid-session has something to
      // check immediately -- see setAutoAnswer().
      const state = getAutoAnswerState(id)
      state.outputBuffer += chunk
      if (state.outputBuffer.length > 4000) {
        state.outputBuffer = state.outputBuffer.slice(-4000)
      }
      maybeAutoAnswer(id)

      try { process.send({ type: 'data', id, chunk }) } catch (_) { /* parent gone */ }
    })
    proc.onExit(({ exitCode, signal }) => {
      sessions.delete(id)
      autoAnswerEnabled.delete(id)
      autoAnswerState.delete(id)
      const waiter = exitWaiters.get(id)
      if (waiter) { exitWaiters.delete(id); waiter() }
      try { process.send({ type: 'exit', id, exitCode, signal }) } catch (_) { /* parent gone */ }
    })
    return { success: true, pid: proc.pid }
  } catch (err) {
    // TICKET-0066: on POSIX, node-pty execs the shell through its native
    // `spawn-helper` binary; if that helper has lost its executable bit the
    // spawn fails with the opaque "posix_spawnp failed". Point at the real
    // cause + fix instead of leaving the user with a bare errno string.
    let error = err.message
    if (process.platform !== 'win32' && /posix_spawnp/i.test(error)) {
      error += ' — node-pty\'s spawn-helper is likely not executable; run `npm run postinstall` (or `node scripts/fix-pty-perms.js`) to restore it.'
    }
    return { success: false, error }
  }
}

function writeSession(id, data) {
  const proc = sessions.get(id)
  if (proc) proc.write(data)
}

function resizeSession(id, cols, rows) {
  const proc = sessions.get(id)
  if (proc && cols > 0 && rows > 0) {
    try { proc.resize(cols, rows) } catch (_) { /* session already gone */ }
  }
}

// Killing more than one ConPTY session at (or near) the same instant is a
// known crash trigger for node-pty's native Windows addon -- e.g. every
// running agent's session tearing down at once when the renderer switches
// projects. Queuing disposals and waiting for each session's own onExit
// (falling back to a timeout if it never fires) before starting the next
// kill() keeps native teardowns from overlapping. See TICKET-0028.
let disposeQueue = Promise.resolve()

function disposeSession(id) {
  disposeQueue = disposeQueue.then(() => killAndWait(id))
  return disposeQueue
}

function killAndWait(id) {
  const proc = sessions.get(id)
  if (!proc) {
    autoAnswerEnabled.delete(id)
    autoAnswerState.delete(id)
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      autoAnswerEnabled.delete(id)
      autoAnswerState.delete(id)
      resolve()
    }
    const timer = setTimeout(finish, 1500)
    exitWaiters.set(id, finish)
    try { proc.kill() } catch (_) { finish() }
  })
}

async function gracefulShutdown() {
  for (const [id] of sessions) disposeSession(id)
  await disposeQueue
}

// Only wired up when actually running under a forked IPC channel (has
// process.send) -- guarded so this file can also be `require()`'d directly
// (no IPC, no pty spawn) purely to unit-test the pure detection functions
// above (stripAnsi/PERMISSION_PROMPT_PATTERN, exported below) against
// captured raw output, without pulling in node-pty or Electron at all.
if (typeof process.send === 'function') {
  process.on('message', (msg) => {
    if (!msg) return
    if (msg.channel === 'shutdown') {
      gracefulShutdown().finally(() => process.exit(0))
      return
    }
    if (!msg.cmd) return
    switch (msg.cmd) {
      case 'spawn': {
        const result = spawnSession(msg)
        try { process.send({ type: 'spawned', id: msg.id, ...result }) } catch (_) { /* parent gone */ }
        break
      }
      case 'write':
        writeSession(msg.id, msg.data)
        break
      case 'resize':
        resizeSession(msg.id, msg.cols, msg.rows)
        break
      case 'dispose':
        disposeSession(msg.id)
        break
      case 'setAutoAnswer':
        setAutoAnswer(msg.id, !!msg.enabled)
        break
      default:
        break
    }
  })

  // Subprocesses spawned via node-pty don't die automatically when this
  // process exits -- every live shell (and any CLI running inside it) must
  // be explicitly killed on shutdown or it's orphaned.
  process.on('SIGTERM', () => {
    gracefulShutdown().finally(() => process.exit(0))
  })

  process.send({ ready: true })
}

module.exports = { stripAnsi, PERMISSION_PROMPT_PATTERN }
