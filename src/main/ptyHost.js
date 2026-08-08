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

function defaultShell() {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

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
    proc.onData((chunk) => {
      try { process.send({ type: 'data', id, chunk }) } catch (_) { /* parent gone */ }
    })
    proc.onExit(({ exitCode, signal }) => {
      sessions.delete(id)
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

function disposeSession(id) {
  const proc = sessions.get(id)
  if (proc) {
    try { proc.kill() } catch (_) { /* already dead */ }
    sessions.delete(id)
  }
}

function gracefulShutdown() {
  for (const [id] of sessions) disposeSession(id)
}

process.on('message', (msg) => {
  if (!msg) return
  if (msg.channel === 'shutdown') {
    gracefulShutdown()
    process.exit(0)
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
  gracefulShutdown()
  process.exit(0)
})

process.send({ ready: true })
