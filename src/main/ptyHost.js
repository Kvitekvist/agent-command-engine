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

// The selection-arrow glyph in front of a numbered "1. Yes" is Ink's
// SelectInput component -- it's how every one of these Claude/Codex
// permission-style prompts (workspace trust, tool permission, etc.) marks
// the currently-highlighted default option, and isn't something the
// assistant's own prose ever emits. Confirmed against both prompt types
// above; "Yes" is always option 1 and already selected, so accepting just
// means submitting the current selection -- no digit needs to be typed.
const PERMISSION_PROMPT_PATTERN = /❯\s*1\.\s*Yes\b/i

function spawnSession({ id, shell, cwd, cols, rows, autoAnswerPermissions }) {
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

    // Track auto-answer setting for this session
    if (autoAnswerPermissions) {
      autoAnswerEnabled.set(id, true)
    }

    // Raw rolling buffer to detect prompts split across chunks -- kept
    // larger than the old 500-char window since a full Ink redraw of a
    // permission box (workspace path, tool args, the menu itself) runs well
    // past that before stripping.
    let outputBuffer = ''
    let lastAutoAnswerTime = 0

    proc.onData((chunk) => {
      // Auto-answer permission prompts if enabled for this session
      if (autoAnswerEnabled.get(id)) {
        outputBuffer += chunk
        if (outputBuffer.length > 4000) {
          outputBuffer = outputBuffer.slice(-4000)
        }

        const now = Date.now()
        const hasPrompt = PERMISSION_PROMPT_PATTERN.test(stripAnsi(outputBuffer))

        // Auto-respond if: prompt detected AND enough time passed since last auto-answer (debounce)
        if (hasPrompt && now - lastAutoAnswerTime > 200) {
          lastAutoAnswerTime = now
          // Small delay to let the prompt fully render before responding
          setTimeout(() => {
            const stillAlive = sessions.get(id)
            if (stillAlive) {
              stillAlive.write('\r') // Confirm the already-selected "1. Yes" option
            }
          }, 100)
          // Clear buffer after auto-answer so we don't match the same prompt twice
          outputBuffer = ''
        }
      }

      try { process.send({ type: 'data', id, chunk }) } catch (_) { /* parent gone */ }
    })
    proc.onExit(({ exitCode, signal }) => {
      sessions.delete(id)
      autoAnswerEnabled.delete(id)
      const waiter = exitWaiters.get(id)
      if (waiter) { exitWaiters.delete(id); waiter() }
      try { process.send({ type: 'exit', id, exitCode, signal }) } catch (_) { /* parent gone */ }
    })
    return { success: true, pid: proc.pid }
  } catch (err) {
    return { success: false, error: err.message }
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
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      autoAnswerEnabled.delete(id)
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
    default:
      break
  }
})

// Subprocesses spawned via node-pty don't die automatically when this
// process exits -- every live shell (and any CLI running inside it) must be
// explicitly killed on shutdown or it's orphaned.
process.on('SIGTERM', () => {
  gracefulShutdown().finally(() => process.exit(0))
})

process.send({ ready: true })
