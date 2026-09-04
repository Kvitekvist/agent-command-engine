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

let cached = null

function ensureHookFiles() {
  if (cached) return cached
  const dir = path.join(app.getPath('userData'), 'ace-hooks')
  const statusDir = path.join(dir, 'status')
  const scriptPath = path.join(dir, 'agent-status.js')
  const soundScriptPath = path.join(dir, 'play-notification.js')
  const audioPath = path.join(dir, 'notification.wav')
  const muteMarker = path.join(dir, '.muted')
  const settingsPath = path.join(dir, 'settings.json')
  fs.mkdirSync(statusDir, { recursive: true })
  fs.writeFileSync(scriptPath, HOOK_SCRIPT)
  fs.writeFileSync(soundScriptPath, SOUND_SCRIPT)

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
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      UserPromptSubmit: entry('working'),
      PreToolUse: entry('working'),
      Notification: entry('waiting', true),
      Stop: entry('waiting', true),
    },
  }, null, 2))

  cached = { dir, statusDir, scriptPath, settingsPath, soundScriptPath, audioPath, muteMarker }
  return cached
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

function safeReaddir(dir) {
  try { return fs.readdirSync(dir) } catch (_) { return [] }
}

module.exports = { ensureHookFiles, watchAgentStatus }
