require('./helpers/electron-stub')
const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')

test('Node setup verifies executables after refreshing PATH, including already-installed and failure cases', { skip: process.platform !== 'win32' }, async t => {
  const hooks = require('../main/services/HookService')
  t.mock.method(hooks, 'ensureHookFiles', () => ({}))
  t.mock.method(hooks, 'watchAgentStatus', () => {})
  t.mock.method(hooks, 'watchQuestionnaireRequests', () => {})
  let refreshed = false
  t.mock.method(require('../main/services/ShellPath'), 'refreshWindowsPath', () => { refreshed = true })
  const handlers = new Map()
  const window = { isDestroyed: () => false, webContents: { mainFrame: {} } }
  require('../main/ipc/handlers').registerHandlers(
    { handle: (key, fn) => handlers.set(key, fn), on() {} }, window, {}, { setWindow() {} }, { setWindow() {} },
  )
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  let installerCode = 0
  let missing = null
  const calls = []
  t.mock.method(require('node:child_process'), 'spawn', cmd => {
    calls.push(cmd)
    if (cmd !== 'winget') assert.equal(refreshed, true)
    const proc = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    queueMicrotask(() => {
      proc.stdout.emit('data', cmd === 'winget' ? 'already installed' : 'v24.0.0')
      proc.emit('close', cmd === 'winget' ? installerCode : cmd === missing ? 1 : 0)
    })
    return proc
  })
  for (const code of [0, -1978335189]) {
    installerCode = code
    for (const unavailable of [null, 'node', 'npm']) {
      missing = unavailable
      refreshed = false
      calls.length = 0
      const result = await handlers.get('prereqs:installNode')(event)
      assert.equal(result.ok, missing === null)
      if (missing) assert.match(result.error, /still unavailable/)
      assert.deepEqual(calls, ['winget', 'node', 'npm'])
    }
  }
  assert.equal(handlers.has('prereqs:relaunch'), false)
})
