const { fork } = require('node:child_process')
const path = require('node:path')
const host = fork(process.env.ACE_PTY_HOST || path.join(__dirname, '../main/ptyHost.js'), [], {
  execPath: process.env.ACE_PTY_EXECUTABLE || process.execPath,
  env: process.env.ACE_PTY_EXECUTABLE ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env,
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
})
let output = ''
let finished = false
const timer = setTimeout(() => finish(new Error('PTY startup timed out: ' + output.slice(-1000))), 15000)
host.stderr.on('data', data => { output += data })
host.stdout.on('data', data => { output += data })
function finish(error) {
  if (finished) return
  finished = true
  clearTimeout(timer)
  process.exitCode = error ? 1 : 0
  if (error) console.error(error.message)
  else console.log('Real PTY startup and I/O passed')
  if (host.connected) host.send({ channel: 'shutdown' })
  const killTimer = setTimeout(() => host.kill(), 4000)
  host.once('exit', () => clearTimeout(killTimer))
}
host.on('error', finish)
host.on('exit', code => { if (!finished) finish(new Error(`PTY host exited: ${code}`)) })
host.on('message', message => {
  if (message.ready) host.send({ cmd: 'spawn', id: 'smoke', cwd: process.cwd(), shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash', cols: 80, rows: 24 })
  if (message.type === 'spawned') {
    if (!message.success) return finish(new Error(message.error))
    const command = process.platform === 'win32' ? "Write-Output ('ACE_PTY_' + 'OK')" : "printf '\\n%s%s\\n' ACE_PTY_ OK"
    host.send({ cmd: 'write', id: 'smoke', data: command + '\r' })
  }
  if (message.type === 'data') {
    output += message.chunk
    // Wait for an output line, not just the echoed command.
    const clean = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    if (clean.includes('ACE_PTY_OK')) finish()
  }
})
