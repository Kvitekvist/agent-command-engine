// Drives each agent card's live status badge (Running / Waiting) from Claude
// Code's own lifecycle hooks instead of guessing from terminal output -- an
// Ink-based TUI repaints on a timer even while idle, so "has the PTY gone
// quiet" flickers once a second. Hooks fire only on real events.
//
// ensureHookFiles() writes, into userData, two tiny node hook scripts plus a
// settings JSON that wires the relevant hook events to them, and copies in the
// bundled notification sound. ACE launches every Claude agent with
// `--settings <that file>` (see agentLaunch.js), so no project or global
// Claude config is touched and everything works on a clean install in any
// project. Each status hook run writes
//   <statusDir>/<session_id>.json  ->  { state: 'working' | 'waiting' }
// which watchAgentStatus() tails and forwards to the renderer; Stop /
// Notification additionally play <dir>/notification.wav unless <dir>/.muted
// exists (toggled from Settings -> settings:set in handlers.js).

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const HOOK_SCRIPT = `const fs = require('fs')
const path = require('path')
const [, , state, statusDir] = process.argv
let input = ''
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  let sessionId
  try { sessionId = JSON.parse(input).session_id } catch (_) {}
  if (sessionId && statusDir) {
    try {
      fs.mkdirSync(statusDir, { recursive: true })
      fs.writeFileSync(
        path.join(statusDir, sessionId + '.json'),
        JSON.stringify({ state, ts: Date.now() }),
      )
    } catch (_) {}
  }
  process.exit(0)
})
`

// Plays argv[2] unless argv[3] (the mute marker) exists. Synchronous on
// purpose: a detached player is torn down when this process exits before it
// makes a sound (that was the long-standing Windows bug). A Stop hook can
// afford to block for the ~2s the clip lasts.
const SOUND_SCRIPT = `const { spawnSync } = require('child_process')
const { existsSync } = require('fs')
const os = require('os')
const [, , audioFile, muteMarker] = process.argv
if (muteMarker && existsSync(muteMarker)) process.exit(0)
if (!audioFile || !existsSync(audioFile)) process.exit(0)
const opt = { stdio: 'ignore', timeout: 15000 }
try {
  if (os.platform() === 'darwin') {
    spawnSync('afplay', [audioFile], opt)
  } else if (os.platform() === 'win32') {
    const f = audioFile.replace(/'/g, "''")
    spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      "(New-Object System.Media.SoundPlayer '" + f + "').PlaySync()"], opt)
  } else {
    for (const p of [['paplay', [audioFile]], ['aplay', ['-q', audioFile]],
        ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', audioFile]]]) {
      if (!spawnSync(p[0], p[1], opt).error) break
    }
  }
} catch (_) {}
process.exit(0)
`

// TICKET-0150: optional popup that helps the user compose their first
// prompt (topic / description / avoid-include / done-looks-like) on a fresh
// Claude session or a `/clear`. Fired from a real `SessionStart` hook rather
// than app-side guessing (e.g. only catching a dedicated Clear button) so it
// also catches the user typing `/clear` by hand. No `matcher` here -- pipe
// alternation on the `source`/`session_start_reason` field isn't reliably
// documented across CLI versions, so every SessionStart runs the script and
// it filters itself. Fire-and-forget: writes a marker and exits immediately,
// never blocking the CLI on the popup being answered.
const SESSION_START_SCRIPT = `const fs = require('fs')
const path = require('path')
const [, , requestDir, disabledMarker] = process.argv
let input = ''
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  if (disabledMarker && fs.existsSync(disabledMarker)) process.exit(0)
  let sessionId, source
  try {
    const parsed = JSON.parse(input)
    sessionId = parsed.session_id
    source = parsed.source || parsed.session_start_reason
  } catch (_) {}
  if (sessionId && requestDir && (source === 'startup' || source === 'clear')) {
    try {
      fs.mkdirSync(requestDir, { recursive: true })
      fs.writeFileSync(
        path.join(requestDir, sessionId + '.json'),
        JSON.stringify({ source, ts: Date.now() }),
      )
    } catch (_) {}
  }
  process.exit(0)
})
`

// TICKET-0151: Prompt Behavior tab needs first-prompt length, which nothing
// in ACE captures -- tokscale reports token counts, never prompt text. This
// hook reads the submitted prompt from stdin and appends ONLY its character
// and word counts to a JSONL file, never the text itself. Runs alongside the
// existing status hook on UserPromptSubmit; fire-and-forget like the others.
const PROMPT_LENGTH_SCRIPT = `const fs = require('fs')
const [, , eventsPath] = process.argv
let input = ''
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  try {
    const parsed = JSON.parse(input)
    const sessionId = parsed.session_id
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : ''
    if (sessionId && eventsPath) {
      const words = prompt.trim() ? prompt.trim().split(/\\s+/).length : 0
      const line = JSON.stringify({ session_id: sessionId, chars: prompt.length, words, ts: Date.now() })
      fs.appendFileSync(eventsPath, line + '\\n')
    }
  } catch (_) {}
  process.exit(0)
})
`

let cached = null

// MSIX packages virtualize AppData writes — ACE sees one path, Claude sees
// another. Use a non-VFS path both can access.
function getHookDir() {
  const isMsix = process.windowsStore ||
    (process.platform === 'win32' && process.execPath.includes('WindowsApps'))
  if (isMsix) return path.join(app.getPath('home'), '.ace-hooks')
  return path.join(app.getPath('userData'), 'ace-hooks')
}

function ensureHookFiles() {
  if (cached) return cached
  const dir = getHookDir()
  const statusDir = path.join(dir, 'status')
  const questionnaireDir = path.join(dir, 'questionnaire')
  const scriptPath = path.join(dir, 'agent-status.js')
  const soundScriptPath = path.join(dir, 'play-notification.js')
  const sessionStartScriptPath = path.join(dir, 'session-start.js')
  const promptLengthScriptPath = path.join(dir, 'prompt-length.js')
  const promptEventsPath = path.join(dir, 'prompt-events.jsonl')
  const audioPath = path.join(dir, 'notification.wav')
  const muteMarker = path.join(dir, '.muted')
  const questionnaireDisabledMarker = path.join(dir, '.questionnaire-disabled')
  const settingsPath = path.join(dir, 'settings.json')
  fs.mkdirSync(statusDir, { recursive: true })
  fs.mkdirSync(questionnaireDir, { recursive: true })
  fs.writeFileSync(scriptPath, HOOK_SCRIPT)
  fs.writeFileSync(soundScriptPath, SOUND_SCRIPT)
  fs.writeFileSync(sessionStartScriptPath, SESSION_START_SCRIPT)
  fs.writeFileSync(promptLengthScriptPath, PROMPT_LENGTH_SCRIPT)

  // Bundled via electron-builder extraResources (packaged) or read straight
  // from the repo (dev). Missing audio just makes the sound hook a silent
  // no-op -- SOUND_SCRIPT guards on existsSync -- so failure here is fine.
  try {
    const audioSrc = app.isPackaged
      ? path.join(process.resourcesPath, 'notification.wav')
      : path.join(app.getAppPath(), '..', 'assets', 'notification.wav')
    fs.copyFileSync(audioSrc, audioPath)
  } catch (_) {}

  // Forward slashes work on every platform and sidestep JSON backslash
  // escaping and shell quoting in the generated command strings.
  const fwd = (p) => p.replace(/\\/g, '/')
  const statusCmd = (state) => ({
    type: 'command',
    command: `node "${fwd(scriptPath)}" ${state} "${fwd(statusDir)}"`,
  })
  const soundCmd = {
    type: 'command',
    command: `node "${fwd(soundScriptPath)}" "${fwd(audioPath)}" "${fwd(muteMarker)}"`,
  }
  const entry = (state, withSound) => [
    { hooks: withSound ? [statusCmd(state), soundCmd] : [statusCmd(state)] },
  ]
  const sessionStartCmd = {
    type: 'command',
    command: `node "${fwd(sessionStartScriptPath)}" "${fwd(questionnaireDir)}" "${fwd(questionnaireDisabledMarker)}"`,
  }
  const promptLengthCmd = {
    type: 'command',
    command: `node "${fwd(promptLengthScriptPath)}" "${fwd(promptEventsPath)}"`,
  }
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ hooks: [statusCmd('working'), promptLengthCmd] }],
      PreToolUse: entry('working'),
      Notification: entry('waiting', true),
      Stop: entry('waiting', true),
      SessionStart: [{ hooks: [sessionStartCmd] }],
    },
  }, null, 2))

  cached = {
    dir, statusDir, scriptPath, settingsPath, soundScriptPath, audioPath, muteMarker,
    questionnaireDir, sessionStartScriptPath, questionnaireDisabledMarker,
    promptLengthScriptPath, promptEventsPath,
  }
  return cached
}

// TICKET-0151: reads the prompt-length JSONL file for the Prompt Behavior
// tab. Pull-based (called on demand from the IPC handler) rather than
// tailed like the status/questionnaire watchers -- there's no live UI
// element waiting on individual events, just an analytics view refreshed on
// open. Tolerant of a torn last line (the hook can be killed mid-append).
function readPromptEvents() {
  const { promptEventsPath } = ensureHookFiles()
  let text
  try { text = fs.readFileSync(promptEventsPath, 'utf8') } catch (_) { return [] }
  const events = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      if (e && typeof e.session_id === 'string') events.push(e)
    } catch (_) { /* torn last line -- skip */ }
  }
  return events
}

// Tail <statusDir> and push { agentId, state } to the renderer whenever a hook
// run rewrites a session's file. sessionId -> agentId comes from the
// agent_sessions table (recorded at launch in AgentTerminal).
function watchAgentStatus(DB, getWindow) {
  const { statusDir } = ensureHookFiles()
  // Stale files from a previous run would misreport a just-launched agent.
  for (const f of safeReaddir(statusDir)) {
    try { fs.unlinkSync(path.join(statusDir, f)) } catch (_) {}
  }
  const emit = (file) => {
    if (!file || !file.endsWith('.json')) return
    const sessionId = file.slice(0, -5)
    let state
    try {
      state = JSON.parse(fs.readFileSync(path.join(statusDir, file), 'utf8')).state
    } catch (_) { return }
    const agentId = DB.getAgentIdBySession(sessionId)
    if (!agentId) return
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('agent:activity', { agentId, state })
  }
  try {
    fs.watch(statusDir, (_evt, file) => emit(file))
  } catch (err) {
    console.error('agent-status watch failed:', err)
  }
}

// Tail <questionnaireDir> and push { agentId, source } to the renderer
// whenever the SessionStart hook drops a one-shot request file. Unlike
// status files (repeatedly overwritten, one per session for its whole
// life), a questionnaire request is consumed once -- delete it right after
// forwarding so a stray extra fs.watch event doesn't re-fire it.
function watchQuestionnaireRequests(DB, getWindow) {
  const { questionnaireDir } = ensureHookFiles()
  for (const f of safeReaddir(questionnaireDir)) {
    try { fs.unlinkSync(path.join(questionnaireDir, f)) } catch (_) {}
  }
  const emit = (file) => {
    if (!file || !file.endsWith('.json')) return
    const filePath = path.join(questionnaireDir, file)
    const sessionId = file.slice(0, -5)
    let source
    try {
      source = JSON.parse(fs.readFileSync(filePath, 'utf8')).source
    } catch (_) { return }
    try { fs.unlinkSync(filePath) } catch (_) {}
    const agentId = DB.getAgentIdBySession(sessionId)
    if (!agentId) return
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('agent:questionnaireRequest', { agentId, source })
  }
  try {
    fs.watch(questionnaireDir, (_evt, file) => emit(file))
  } catch (err) {
    console.error('questionnaire-request watch failed:', err)
  }
}

function safeReaddir(dir) {
  try { return fs.readdirSync(dir) } catch (_) { return [] }
}

module.exports = { ensureHookFiles, watchAgentStatus, watchQuestionnaireRequests, readPromptEvents }
