const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const child_process = require('node:child_process')
const { ensureShellPath, loginShellPath, isOnPath } = require('../main/services/ShellPath')

function makeFakeNodeDir(root, rel) {
  const dir = path.join(root, rel)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'node'), '')
  return dir
}

test('isOnPath finds a command in a PATH directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shellpath-'))
  const dir = makeFakeNodeDir(root, 'bin')
  assert.equal(isOnPath('node', dir), true)
  assert.equal(isOnPath('node', path.join(root, 'nowhere')), false)
})

test('is a no-op on Windows regardless of PATH', (t) => {
  const spawnSync = t.mock.method(child_process, 'spawnSync', () => { throw new Error('should not spawn') })
  const env = { PATH: '/nowhere' }
  assert.equal(ensureShellPath({ env, platform: 'win32' }), false)
  assert.equal(spawnSync.mock.callCount(), 0)
})

test('leaves PATH alone when node is already resolvable -- no shell spawn needed', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shellpath-'))
  const dir = makeFakeNodeDir(root, 'bin')
  const spawnSync = t.mock.method(child_process, 'spawnSync', () => { throw new Error('should not spawn') })
  const env = { PATH: dir }
  assert.equal(ensureShellPath({ env, platform: 'darwin' }), false)
  assert.equal(env.PATH, dir)
  assert.equal(spawnSync.mock.callCount(), 0)
})

test('replaces PATH with the login shell value when node is missing from the inherited one', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shellpath-'))
  const shellPath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
  t.mock.method(child_process, 'spawnSync', () => ({
    stdout: `noise before\n__ACE_PATH__${shellPath}__ACE_PATH__\n`, error: null,
  }))
  const env = { PATH: path.join(root, 'launchd-default'), SHELL: '/bin/zsh' }
  const changed = ensureShellPath({ env, platform: 'darwin' })
  assert.equal(changed, true)
  assert.equal(env.PATH, shellPath)
})

test('loginShellPath returns null on a spawn error, timeout or unparsable output', (t) => {
  t.mock.method(child_process, 'spawnSync', () => ({ error: new Error('boom') }))
  assert.equal(loginShellPath({ env: {}, platform: 'darwin' }), null)
})

test('is a no-op off Windows when the shell produced nothing', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shellpath-'))
  t.mock.method(child_process, 'spawnSync', () => ({ stdout: '', error: null }))
  const env = { PATH: path.join(root, 'nowhere') }
  assert.equal(ensureShellPath({ env, platform: 'darwin' }), false)
  assert.equal(env.PATH, path.join(root, 'nowhere'))
})
