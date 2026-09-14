const { app } = require('electron')
const { fork } = require('child_process')
const { randomUUID } = require('crypto')
const path = require('path')

// TICKET-0019: forks and supervises ptyHost.js (see its header comment for
// why node-pty lives in its own process), and forwards its data/exit
// events to the renderer. Mirrors AgentService's init(mainWindow)/setWindow()
// shape so index.js wires both services the same way.
class TerminalService {
  constructor() {
    this.mainWindow = null
    this.host = null
    this.pendingSpawns = new Map()
    this.isShuttingDown = false
    this.sessions = new Map()
    this.onState = () => {}
  }

  init(mainWindow) {
    this.mainWindow = mainWindow
    this._startHost()
  }

  setWindow(win) {
    this.mainWindow = win
  }

  _forkHost() {
    const scriptPath = path.join(__dirname, '..', 'ptyHost.js')
    // Same trick AgentService/DBService's native-module deps rely on: never
    // load node-pty into Electron's own main process, only into a forked
    // process running plain node ABI (dev) or Electron-binary-as-node
    // (packaged), so no electron-rebuild step is needed.
    const useElectronNode = app.isPackaged && !process.env.SYSTEM_NODE
    return fork(scriptPath, [], {
      execPath: process.env.SYSTEM_NODE || (useElectronNode ? process.execPath : 'node'),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      // Without this, Windows shows a console window for this forked
      // node.exe process -- child_process.fork()'s default behavior when a
      // console-subsystem executable is spawned from a windowed
      // (GUI-subsystem) parent like Electron's main process.
      windowsHide: true,
      env: useElectronNode
        ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        : process.env,
    })
  }

  _startHost() {
    const hostProcess = this._forkHost()
    this.host = hostProcess

    hostProcess.stdout.on('data', (data) => console.log('[ptyHost]', data.toString().trim()))
    hostProcess.stderr.on('data', (data) => console.error('[ptyHost]', data.toString().trim()))

    hostProcess.on('message', (msg) => {
      if (!msg) return
      if (msg.ready) {
        console.log('PTY host process ready')
        return
      }
      if (msg.type === 'spawned') {
        const pending = this.pendingSpawns.get(msg.id)
        if (pending) {
          pending.resolve(msg)
          this.pendingSpawns.delete(msg.id)
        }
        return
      }
      if (msg.type === 'data') {
        const session = [...this.sessions.values()].find(s => s.id === msg.id)
        if (session) {
          session.output = (session.output + msg.chunk).slice(-262144)
          session.sequence++
        }
        this._send('terminal:data', { id: msg.id, agentId: session?.agentId, chunk: msg.chunk, sequence: session?.sequence })
        return
      }
      if (msg.type === 'exit') {
        const session = [...this.sessions.values()].find(s => s.id === msg.id)
        if (session) {
          session.state = msg.exitCode === 0 ? 'exited' : 'error'
          session.exitCode = msg.exitCode
          this.onState(session.agentId, session.state)
        }
        // A spawn that crashes the host before ever confirming 'spawned'
        // would otherwise leave its caller's promise unresolved forever.
        const pending = this.pendingSpawns.get(msg.id)
        if (pending) {
          pending.resolve({ success: false, error: 'PTY host exited before confirming spawn' })
          this.pendingSpawns.delete(msg.id)
        }
        this._send('terminal:exit', { id: msg.id, exitCode: msg.exitCode, signal: msg.signal })
        return
      }
    })

    hostProcess.on('error', (error) => console.error('PTY host process error:', error))

    hostProcess.on('exit', (code) => {
      console.log(`PTY host exited with code ${code}`)
      if (this.host === hostProcess) this.host = null
      for (const [, pending] of this.pendingSpawns) {
        pending.resolve({ success: false, error: 'PTY host process crashed' })
      }
      this.pendingSpawns.clear()
      for (const session of this.sessions.values()) {
        if (session.state === 'running' || session.state === 'connecting') {
          session.state = 'lost'
          this.onState(session.agentId, 'lost')
        }
      }
      // Every live terminal session lives entirely in the host process's
      // memory -- a host crash always takes them all down with it, so tell
      // the renderer explicitly rather than leaving a panel that looks
      // merely frozen.
      this._send('terminal:hostRestarted')
      if (!this.isShuttingDown) {
        console.log('Restarting PTY host process...')
        this._startHost()
      }
    })
  }

  _send(channel, payload) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload)
    }
  }

  spawn(opts = {}) {
    const existing = this.sessions.get(opts.agentId)
    if (existing) {
      if (existing.state === 'connecting') return existing.pending.then(result => ({ ...result, reconnected: true, output: existing.output, sequence: existing.sequence, autoAnswer: !!existing.autoAnswer }))
      if (existing.state !== 'running') return Promise.resolve({ success: false, error: `Session ${existing.state}; launch a new agent explicitly` })
      return Promise.resolve({ success: true, id: existing.id, pid: existing.pid, reconnected: true, output: existing.output, sequence: existing.sequence, autoAnswer: !!existing.autoAnswer })
    }
    // ponytail: replay the last 256K characters; full terminal snapshots if longer recovery history is needed.
    const session = { agentId: opts.agentId, id: randomUUID(), output: '', sequence: 0, state: 'connecting' }
    this.sessions.set(opts.agentId, session)
    session.pending = new Promise((resolve) => {
      if (!this.host || !this.host.connected) {
        session.state = 'error'
        resolve({ success: false, error: 'Terminal host process is not available' })
        return
      }
      const id = session.id
      const timer = setTimeout(() => {
        this.pendingSpawns.delete(id)
        session.state = 'lost'
        this.dispose(id)
        this.onState(opts.agentId, 'lost')
        resolve({ success: false, error: 'Terminal startup timed out' })
      }, 15000)
      this.pendingSpawns.set(id, {
        resolve: (msg) => {
          clearTimeout(timer)
          if (this.sessions.get(opts.agentId) !== session) {
            this.dispose(id)
            resolve({ success: false, error: 'Agent stopped during startup' })
            return
          }
          session.state = msg.success ? 'running' : 'error'
          session.pid = msg.pid
          if (msg.success && opts.command) this.write(id, opts.command + '\r')
          this.onState(opts.agentId, session.state)
          resolve({ success: !!msg.success, id, pid: msg.pid, error: msg.error, output: session.output, sequence: session.sequence })
        },
      })
      try {
        this.host.send({
          cmd: 'spawn',
          id,
          shell: opts.shell,
          cwd: opts.cwd,
          cols: opts.cols,
          rows: opts.rows,
        })
      } catch (error) {
        clearTimeout(timer)
        this.pendingSpawns.delete(id)
        session.state = 'error'
        resolve({ success: false, error: `PTY host communication failed: ${error.message}` })
      }
    })
    return session.pending
  }

  stopAgent(agentId) {
    const session = this.sessions.get(agentId)
    if (!session) return
    this.dispose(session.id)
    this.sessions.delete(agentId)
  }

  write(id, data) {
    if (this.host && this.host.connected) {
      try { this.host.send({ cmd: 'write', id, data }) } catch (_) { /* host gone */ }
    }
  }

  resize(id, cols, rows) {
    if (this.host && this.host.connected) {
      try { this.host.send({ cmd: 'resize', id, cols, rows }) } catch (_) { /* host gone */ }
    }
  }

  dispose(id) {
    if (this.host && this.host.connected) {
      try { this.host.send({ cmd: 'dispose', id }) } catch (_) { /* host gone */ }
    }
  }

  // TICKET-0039: flips auto-answer on/off for a session that's already
  // running, so a permission prompt already on screen doesn't require the
  // agent to be stopped and relaunched to resolve.
  setAutoAnswer(id, enabled) {
    const session = [...this.sessions.values()].find(session => session.id === id)
    if (session) session.autoAnswer = !!enabled
    if (this.host && this.host.connected) {
      try { this.host.send({ cmd: 'setAutoAnswer', id, enabled }) } catch (_) { /* host gone */ }
    }
  }

  // A forked child process doesn't die with its parent -- always give it a
  // chance to clean up its own subprocesses before force-killing.
  async shutdown() {
    this.isShuttingDown = true
    const proc = this.host
    if (!proc) return
    if (proc.connected) {
      const exitPromise = new Promise((resolve) => {
        proc.once('exit', resolve)
        setTimeout(resolve, 3000)
      })
      try { proc.send({ channel: 'shutdown' }) } catch (_) { /* already gone */ }
      await exitPromise
      if (proc.connected) proc.kill()
    } else {
      proc.kill()
    }
  }
}

module.exports = { TerminalService: new TerminalService(), TerminalServiceClass: TerminalService }
