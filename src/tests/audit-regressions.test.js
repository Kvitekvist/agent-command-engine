const { electronStub } = require('./helpers/electron-stub')
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { makeTempDir } = require('./helpers/temp-dir')
const { FileService } = require('../main/services/FileService')
const { notesOperation } = require('../main/services/NotesService')
const { detectBuild } = require('../main/services/ProjectBuild')

test('Notes merges two panels and an external append, then deletes only selected identity', async () => {
  const root = makeTempDir('ace-notes-audit-')
  assert.deepEqual((await notesOperation(root)).notes, [])
  const first = await notesOperation(root, { type: 'add', text: 'first\n---\nUnicode: æ 🐈' })
  await notesOperation(root, { type: 'add', text: 'second' })
  fs.appendFileSync(path.join(root, '.ace/notes.txt'), JSON.stringify({ id: 'external', timestamp: '2026-09-13', text: 'external' }) + '\r\n')
  const result = await notesOperation(root, { type: 'delete', id: first.notes[0].id, expectedText: first.notes[0].text })
  assert.equal(result.ok, true)
  assert.deepEqual(result.notes.map(n => n.text), ['second', 'external'])
  assert.equal((await notesOperation(root, { type: 'edit', id: result.notes[0].id, expectedText: 'stale', text: 'bad' })).ok, false)
  fs.writeFileSync(path.join(root, '.ace/notes.txt'), '{invalid JSON')
  await assert.rejects(notesOperation(root, { type: 'add', text: 'must not overwrite' }))
  assert.equal(fs.readFileSync(path.join(root, '.ace/notes.txt'), 'utf8'), '{invalid JSON')
})

test('editor conflicts preserve external bytes; successful snapshot save replaces file', () => {
  const root = makeTempDir('ace-editor-audit-')
  FileService.writeFile(root, 'file.txt', 'original')
  fs.writeFileSync(path.join(root, 'file.txt'), 'external')
  const conflict = FileService.writeFile(root, 'file.txt', 'editor', 'original')
  assert.equal(conflict.reason, 'conflict')
  assert.equal(fs.readFileSync(path.join(root, 'file.txt'), 'utf8'), 'external')
  assert.equal(FileService.writeFile(root, 'file.txt', 'editor', 'external').ok, true)
  assert.deepEqual(fs.readdirSync(root), ['file.txt'])
})

test('build detection falls back from unrelated src package and supports ordinary npm', () => {
  // detectBuild resolves through resolveWithinRoot, which realpaths for
  // symlink-escape confinement (ProjectPath.js) -- on CI, os.tmpdir() can be
  // a symlink (macOS's /var -> /private/var) or an 8.3 short name (Windows'
  // RUNNER~1), so the raw mkdtemp path won't strictly-equal detectBuild's
  // returned cwd unless it's realpathed the same way first.
  const root = fs.realpathSync.native(makeTempDir('ace-build-audit-'))
  assert.equal(detectBuild(root).ok, false)
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'src/package.json'), '{}')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'echo ok' } }))
  assert.equal(detectBuild(root).cwd, root)
  fs.writeFileSync(path.join(root, 'src/package.json'), JSON.stringify({ scripts: { build: 'echo src' } }))
  assert.equal(detectBuild(root).cwd, path.join(root, 'src'))
})

test('registered IPC rejects unauthorized projects, terminals and external schemes', async (t) => {
  const root = fs.realpathSync.native(makeTempDir('ace-ipc-audit-'))
  const hooks = require('../main/services/HookService')
  electronStub.dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }), showMessageBox: async () => ({ response: 0 }) }
  hooks.ensureHookFiles = () => ({ dir: root, settingsPath: path.join(root, 'hooks.json') })
  hooks.watchAgentStatus = () => {}
  hooks.watchQuestionnaireRequests = () => {}
  require('../main/services/ProviderExecutable').providerExecutable = () => ['test-provider']
  const { registerHandlers } = require('../main/ipc/handlers')
  const handlers = new Map()
  const ipc = { handle: (key, fn) => handlers.set(key, fn), on: () => {} }
  const window = { isDestroyed: () => false, webContents: { mainFrame: { parent: null } } }
  let currentWindow = window
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  const projects = [{ id: 1, path: root, name: 'test' }]
  const DB = { getProjects: () => projects, addProject: (name, folder) => projects.push({ id: 2, name, path: folder }), getAgentsByProject: () => [], getSetting: () => null }
  const Agent = { setWindow() {}, agents: new Map([['agent', { meta: { projectId: 1, projectPath: root, provider: 'codex', model: 'gpt-5.6-terra' } }]]) }
  let spawns = 0
  const Terminal = { setWindow() {}, spawn: () => { spawns++; return { success: true } }, sessions: new Map() }
  electronStub.dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) }
  registerHandlers(ipc, () => currentWindow, DB, Agent, Terminal)
  const call = (channel, ...args) => handlers.get(channel)(event, ...args)
  const png = Buffer.from('encoded image')
  electronStub.clipboard = { readImage: () => { throw new Error('Clipboard changed') } }
  electronStub.nativeImage = { createFromBuffer: bytes => {
    assert.deepEqual(bytes, png)
    return { isEmpty: () => false, toPNG: () => png }
  } }
  const saved = call('clipboard:saveImage', { projectPath: root, imageBytes: new Uint8Array(png) })
  assert.equal(saved.success, true)
  assert.deepEqual(fs.readFileSync(saved.path), png)
  assert.equal(call('clipboard:saveImage', { projectPath: root, imageBytes: 'invalid' }).success, false)
  assert.equal(call('clipboard:saveImage', { projectPath: path.dirname(root), imageBytes: new Uint8Array(png) }).success, false)
  assert.match(call('clipboard:saveImage', { projectPath: root }).error, /Clipboard changed/)
  electronStub.nativeImage.createFromBuffer = () => ({ isEmpty: () => true })
  assert.equal(call('clipboard:saveImage', { projectPath: root, imageBytes: new Uint8Array([0]) }).success, false)
  const revealed = []
  t.mock.method(electronStub.shell, 'showItemInFolder', file => revealed.push(file))
  assert.equal(call('shell:showInFolder', { filePath: saved.relativePath, projectPath: root }).success, true)
  assert.equal(call('shell:showInFolder', { filePath: require('node:url').pathToFileURL(saved.path).href, projectPath: root }).success, true)
  assert.deepEqual(revealed, [saved.path, saved.path])
  assert.equal(call('shell:showInFolder', { filePath: 'missing.js', projectPath: root }).success, false)
  await assert.rejects(call('terminal:spawn', {}), /project path/)
  await assert.rejects(call('terminal:spawn', { cwd: path.dirname(root) }), /registered project/)
  await assert.rejects(call('terminal:spawn', { cwd: root, agentId: 'agent', shell: 'malicious' }), /shell/)
  await assert.rejects(call('terminal:spawn', { cwd: root, agentId: 'agent', cols: Infinity }), /dimensions/)
  assert.equal(spawns, 0)
  assert.throws(() => call('projects:add', 'test', root), /native dialog/)
  assert.equal((await call('shell:openUrl', 'https://example.com')).ok, true)
  for (const url of ['file:///tmp/a', 'javascript:alert(1)', 'not a url', 42]) assert.equal((await call('shell:openUrl', url)).ok, false)
  assert.throws(() => handlers.get('projects:getAll')({ sender: {}, senderFrame: { parent: null } }), /not permitted/)
  await call('terminal:spawn', { cwd: root, agentId: 'agent' })
  assert.equal(spawns, 1)
  Terminal.sessions.set('agent', { state: 'running' })
  await call('terminal:spawn', { cwd: root, agentId: 'agent' })
  assert.equal(spawns, 2)
  const stopped = []
  const deleted = []
  DB.getAgentsByProject = id => id === 99 ? [{ id: 'unvisited' }] : []
  DB.deleteAgent = id => deleted.push(id)
  DB.removeProject = id => assert.equal(id, 99)
  Terminal.stopAgent = id => stopped.push(id)
  Agent.stop = id => assert.equal(id, 'unvisited')
  call('projects:remove', 99)
  assert.deepEqual(stopped, ['unvisited'])
  assert.deepEqual(deleted, ['unvisited'])
  assert.equal(Terminal.sessions.has('agent'), true)
  const selected = await call('projects:pickFolder')
  call('projects:add', 'selected', selected)
  assert.equal(projects.length, 2)
  const { EventEmitter } = require('node:events')
  let probes = 0
  let killed = 0
  t.mock.method(require('node:child_process'), 'spawn', () => {
    probes++
    const proc = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.kill = () => { killed++ }
    return proc
  })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const checks = call('prereqs:check')
  t.mock.timers.tick(8001)
  const results = await checks
  assert.equal(Object.values(results).every(result => result.error.includes('timed out')), true)
  assert.equal(killed, 5)
  await call('prereqs:uninstall', 'codex')
  assert.equal(probes, 5, 'cancelled uninstall must not spawn npm')
  currentWindow = { isDestroyed: () => false, webContents: { mainFrame: { parent: null } } }
  assert.throws(() => call('projects:getAll'), /not permitted/)
  assert.equal(handlers.get('projects:getAll')({ sender: currentWindow.webContents, senderFrame: currentWindow.webContents.mainFrame }).length, 2)
})
