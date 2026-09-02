// Drives each agent card's live status badge (Running / Waiting) from Claude
// Code's own lifecycle hooks instead of guessing from terminal output -- an
// Ink-based TUI repaints on a timer even while idle, so "has the PTY gone
// quiet" flickers once a second. Hooks fire only on real events.
//
// ensureHookFiles() writes, into userData, a tiny node hook script plus a
// settings JSON that wires the relevant hook events to it. ACE launches every
// Claude agent with `--settings <that file>` (see agentLaunch.js), so no
// project or global Claude config is touched. Each hook run writes
//   <statusDir>/<session_id>.json  ->  { state: 'working' | 'waiting' }
// which watchAgentStatus() tails and forwards to the renderer.

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

let cached = null

function ensureHookFiles() {
  if (cached) return cached
  const dir = path.join(app.getPath('userData'), 'ace-hooks')
  const statusDir = path.join(dir, 'status')
  const scriptPath = path.join(dir, 'agent-status.js')
  const settingsPath = path.join(dir, 'settings.json')
  fs.mkdirSync(statusDir, { recursive: true })
  fs.writeFileSync(scriptPath, HOOK_SCRIPT)

  // Forward slashes work on every platform and sidestep JSON backslash
  // escaping and shell quoting in the generated command strings.
  const s = scriptPath.replace(/\\/g, '/')
  const sd = statusDir.replace(/\\/g, '/')
  const entry = (state) => [
    { hooks: [{ type: 'command', command: `node "${s}" ${state} "${sd}"` }] },
  ]
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      UserPromptSubmit: entry('working'),
      PreToolUse: entry('working'),
      Notification: entry('waiting'),
      Stop: entry('waiting'),
    },
  }, null, 2))

  cached = { dir, statusDir, scriptPath, settingsPath }
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
