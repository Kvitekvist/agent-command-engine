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
        this._send('terminal:data', { id: msg.id, chunk: msg.chunk })
        return
      }
      if (msg.type === 'exit') {
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
    return new Promise((resolve) => {
      if (!this.host || !this.host.connected) {
        resolve({ success: false, error: 'Terminal host process is not available' })
        return
      }
      const id = randomUUID()
      this.pendingSpawns.set(id, {
        resolve: (msg) => resolve({ success: !!msg.success, id, pid: msg.pid, error: msg.error }),
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
        this.pendingSpawns.delete(id)
        resolve({ success: false, error: `PTY host communication failed: ${error.message}` })
      }
    })
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

module.exports = { TerminalService: new TerminalService() }
