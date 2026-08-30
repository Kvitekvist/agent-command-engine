require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')

const { resolveProjectRoot, assertAppSender } = require('../main/ipc/handlers')

const REGISTERED = path.resolve('/tmp/ace-projects/alpha')
const dbWith = (...paths) => ({
  getProjects: () => paths.map((p, i) => ({ id: i + 1, name: `p${i}`, path: p })),
})

test('resolveProjectRoot returns the stored path for an exact match', () => {
  assert.equal(resolveProjectRoot(dbWith(REGISTERED), REGISTERED), REGISTERED)
})

test('resolveProjectRoot normalises separators and . segments before matching', () => {
  const messy = path.join(REGISTERED, '.', 'beta', '..')
  assert.equal(resolveProjectRoot(dbWith(REGISTERED), messy), REGISTERED)
})

test('resolveProjectRoot rejects a path that is not a registered project', () => {
  assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), path.resolve('/etc')), /not a registered project/)
})

test('resolveProjectRoot rejects a traversal out of a registered root', () => {
  const escape = path.join(REGISTERED, '..', '..', '..', 'secrets')
  assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), escape), /not a registered project/)
})

test('resolveProjectRoot rejects empty / non-string input', () => {
  assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), ''), /required/)
  assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), null), /required/)
  assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), 42), /required/)
})

test('resolveProjectRoot matches case-insensitively on Windows only', () => {
  const shouted = REGISTERED.toUpperCase()
  if (process.platform === 'win32') {
    assert.equal(resolveProjectRoot(dbWith(REGISTERED), shouted), REGISTERED)
  } else {
    assert.throws(() => resolveProjectRoot(dbWith(REGISTERED), shouted), /not a registered project/)
  }
})

test('assertAppSender allows a top-level frame and rejects subframes', () => {
  assert.doesNotThrow(() => assertAppSender({ senderFrame: { parent: null } }))
  assert.throws(() => assertAppSender({ senderFrame: { parent: {} } }), /not permitted/)
  assert.throws(() => assertAppSender({ senderFrame: null }), /not permitted/)
  assert.throws(() => assertAppSender({}), /not permitted/)
})
