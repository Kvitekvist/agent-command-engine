require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./helpers/temp-dir')
const { FileService } = require('../main/services/FileService')

// TICKET-0166: window.ace.fs backed by the real FileService, wrapped the same
// way the fs:readFile / fs:writeFile IPC handlers wrap it.
function fakeAce(overrides = {}) {
  const wrap = (fn) => (...args) => { try { return fn(...args) } catch (error) { return { ok: false, error: error.message, code: error.code } } }
  global.window = { ace: { fs: {
    readFile: async (root, file) => wrap(() => FileService.readFile(root, path.join(root, file)))(),
    writeFile: async (root, file, content, expected) => wrap(() => FileService.writeFile(root, path.join(root, file), content, expected))(),
    ...overrides,
  } } }
}

const load = () => import('../renderer/utils/claudeSettings.mjs')
const settingsPath = (root) => path.join(root, '.claude', 'settings.local.json')
function project(content) {
  const root = makeTempDir('ace-claude-settings-')
  if (content !== undefined) {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true })
    fs.writeFileSync(settingsPath(root), content)
  }
  return root
}

test('a missing settings file reads as empty and is created on write', async () => {
  fakeAce()
  const { readLocalSettings, writeLocalSettings } = await load()
  const root = project()
  const local = await readLocalSettings(root)
  assert.deepEqual(local, { settings: {}, raw: null })
  const result = await writeLocalSettings(root, local.raw, (s) => { s.skillOverrides = { a: 'off' } })
  assert.equal(result.ok, true)
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath(root), 'utf8')), { skillOverrides: { a: 'off' } })
})

test('writes keep unrelated keys', async () => {
  fakeAce()
  const { readLocalSettings, writeLocalSettings } = await load()
  const root = project(JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, model: 'x' }))
  const local = await readLocalSettings(root)
  await writeLocalSettings(root, local.raw, (s) => { s.enabledPlugins = { p: true } })
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath(root), 'utf8')), { permissions: { allow: ['Bash(ls)'] }, model: 'x', enabledPlugins: { p: true } })
})

test('malformed JSON and non-object settings are errors, and the file is left alone', async () => {
  fakeAce()
  const { readLocalSettings, writeLocalSettings } = await load()
  for (const bad of ['{ "permissions": ', '[]', '"text"', 'null']) {
    const root = project(bad)
    await assert.rejects(readLocalSettings(root), /settings\.local\.json/)
    await assert.rejects(writeLocalSettings(root, bad, (s) => { s.x = 1 }), /settings\.local\.json/)
    assert.equal(fs.readFileSync(settingsPath(root), 'utf8'), bad)
  }
})

test('a read failure other than a missing file is an error', async () => {
  fakeAce({ readFile: async () => ({ ok: false, error: 'EACCES: permission denied', code: 'EACCES' }) })
  const { readLocalSettings } = await load()
  await assert.rejects(readLocalSettings('/any'), /EACCES/)
})

test('a file created after an absent read is a conflict, not overwritten', async () => {
  fakeAce()
  const { readLocalSettings, writeLocalSettings } = await load()
  const root = project()
  const local = await readLocalSettings(root)
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true })
  fs.writeFileSync(settingsPath(root), '{"model":"someone-else"}')
  const result = await writeLocalSettings(root, local.raw, (s) => { s.x = 1 })
  assert.equal(result.reason, 'conflict')
  assert.equal(fs.readFileSync(settingsPath(root), 'utf8'), '{"model":"someone-else"}')
})
