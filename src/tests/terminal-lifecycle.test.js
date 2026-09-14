require('./helpers/electron-stub')
const test = require('node:test')
const assert = require('node:assert/strict')
const { TerminalServiceClass } = require('../main/services/TerminalService')
const { EventEmitter } = require('node:events')

test('host output has replay sequence and host failure marks sessions lost', () => {
  const service = new TerminalServiceClass()
  const host = new EventEmitter()
  host.stdout = new EventEmitter()
  host.stderr = new EventEmitter()
  const states = []
  service.onState = (id, state) => states.push([id, state])
  service._forkHost = () => host
  service.isShuttingDown = true
  service.sessions.set('agent', { agentId: 'agent', id: 'pty', state: 'running', output: '', sequence: 0 })
  service._startHost()
  host.emit('message', { type: 'data', id: 'pty', chunk: 'hello' })
  assert.equal(service.sessions.get('agent').sequence, 1)
  assert.equal(service.sessions.get('agent').output, 'hello')
  host.emit('exit', 1)
  assert.equal(service.sessions.get('agent').state, 'lost')
  assert.deepEqual(states, [['agent', 'lost']])
})

test('reconnect does not spawn or launch twice, and stop disposes only its own PTY', async () => {
  const service = new TerminalServiceClass()
  const sent = []
  service.host = { connected: true, send: msg => sent.push(msg) }
  const first = service.spawn({ agentId: 'a', command: 'claude', cwd: process.cwd() })
  const reconnect = service.spawn({ agentId: 'a', command: 'claude', cwd: process.cwd() })
  const id = sent[0].id
  service.pendingSpawns.get(id).resolve({ success: true, pid: 100 })
  assert.equal((await first).success, true)
  assert.equal((await reconnect).reconnected, true)
  assert.equal(sent.filter(msg => msg.cmd === 'spawn').length, 1)
  assert.equal(sent.filter(msg => msg.cmd === 'write').length, 1)
  service.sessions.get('a').output = 'retained'
  assert.equal((await service.spawn({ agentId: 'a' })).output, 'retained')
  service.stopAgent('a')
  assert.deepEqual(sent.at(-1), { cmd: 'dispose', id })
  assert.equal(service.sessions.size, 0)
})

test('stop during pending spawn never launches the CLI after acknowledgement', async () => {
  const service = new TerminalServiceClass()
  const sent = []
  service.host = { connected: true, send: msg => sent.push(msg) }
  const pending = service.spawn({ agentId: 'a', command: 'claude' })
  const id = sent[0].id
  service.stopAgent('a')
  service.pendingSpawns.get(id).resolve({ success: true, pid: 1 })
  assert.equal((await pending).success, false)
  assert.equal(sent.some(msg => msg.cmd === 'write'), false)
})
