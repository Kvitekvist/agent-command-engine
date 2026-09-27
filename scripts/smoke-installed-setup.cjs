// Runs with the installed Electron executable's embedded Node, no guest npm needed.
const fs = require('node:fs')
const path = require('node:path')
const { setTimeout: pause } = require('node:timers/promises')

async function waitForSetup({ sample, alive, timeoutMs, stableMs = 15000, now = Date.now, sleep = pause, record = () => {} }) {
  const started = now()
  let readySince = null
  let sawSetup = false
  while (now() - started < timeoutMs) {
    if (!alive()) throw new Error('ACE exited or restarted during first-run setup')
    const state = await sample()
    record(state)
    sawSetup ||= !!state?.setup
    if (state?.errors?.length) throw new Error('Setup error: ' + state.errors.join('\n'))
    const ready = ['node', 'npm', 'git', 'claude', 'codex'].every(name => state?.prereqs?.[name]?.present)
    if (ready && sawSetup) {
      readySince ??= now()
      if (now() - readySince >= stableMs) return state
    } else readySince = null
    await sleep(2000)
  }
  throw new Error('Setup timed out before all prerequisites stayed ready (or the setup screen never appeared)')
}

async function connect(port, alive, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let target
  while (Date.now() < deadline) {
    if (!alive()) throw new Error('ACE exited before its setup screen opened')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
      target = (await response.json()).find(item => item.type === 'page' && item.url.startsWith('file:') && item.url.includes('/dist/renderer/index.html'))
      if (target) break
    } catch (_) {}
    await pause(500)
  }
  if (!target) throw new Error('Installed ACE renderer debugging endpoint did not open')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Debugger connection timed out')), 5000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Debugger connection failed')) }, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    clearTimeout(request.timer)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('ACE renderer disconnected (possible crash or restart)'))
    }
    pending.clear()
  })
  return {
    close: () => socket.close(),
    call: (method, params = {}) => new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) return reject(new Error('Debugger is disconnected'))
      const id = ++sequence
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, 20000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    }),
  }
}

async function main(configFile) {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''))
  const report = { passed: false, started: new Date().toISOString(), samples: [] }
  const output = path.dirname(configFile)
  const alive = () => { try { process.kill(config.pid, 0); return true } catch (_) { return false } }
  let debuggerClient
  try {
    debuggerClient = await connect(config.port, alive, Math.min(config.timeoutMs, 60000))
    await waitForSetup({
      alive, timeoutMs: config.timeoutMs,
      record: state => report.samples.push({ time: new Date().toISOString(), ...state }),
      sample: async () => {
        const response = await debuggerClient.call('Runtime.evaluate', {
          expression: `(async () => ({
            setup: document.body.innerText.includes('Set up Agent Command Engine'),
            errors: [...document.querySelectorAll('.text-danger')].map(e => e.innerText).filter(Boolean),
            prereqs: window.ace ? await window.ace.prereqs.check() : null
          }))()`,
          awaitPromise: true, returnByValue: true,
        })
        if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
        return response.result.value
      },
    })
    report.passed = true
  } catch (error) { report.error = error.message }
  finally {
    if (debuggerClient) {
      try {
        const screenshot = await debuggerClient.call('Page.captureScreenshot')
        fs.writeFileSync(path.join(output, 'setup.png'), Buffer.from(screenshot.data, 'base64'))
      } catch (error) { report.screenshotError = error.message }
      debuggerClient.close()
    }
    if (report.passed && !alive()) {
      report.passed = false
      report.error = 'ACE exited before evidence collection completed'
    }
    report.finished = new Date().toISOString()
    fs.writeFileSync(path.join(output, 'setup.json'), JSON.stringify(report, null, 2))
  }
  if (!report.passed) throw new Error(report.error)
  console.log('Installed ACE setup passed: Node, npm, Git, Claude and Codex ready without restart')
}

if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { waitForSetup }
