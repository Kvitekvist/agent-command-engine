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

    // Buffer to detect permission prompts across chunks
    let outputBuffer = ''
    let lastAutoAnswerTime = 0

    proc.onData((chunk) => {
      // TEMPORARILY DISABLED - Testing if auto-answer causes spacebar issue
      // Will re-enable with better implementation after testing

      // if (autoAnswerEnabled.get(id)) {
      //   outputBuffer += chunk
      //   ... auto-answer logic ...
      // }

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
