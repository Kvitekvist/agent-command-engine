const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { ensureGitOnPath } = require('../main/services/GitPath')

function makeFakeGitDir(root, rel) {
  const dir = path.join(root, rel)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'git.exe'), '')
  return dir
}

test('leaves PATH alone when git is already resolvable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpath-'))
  const onPath = makeFakeGitDir(root, 'on-path')
  const env = { PATH: onPath }
  const changed = ensureGitOnPath({ env, platform: 'win32', packaged: false, appPath: root })
  assert.equal(changed, false)
  assert.equal(env.PATH, onPath)
})

test('prepends bundled mingit when git is missing from PATH', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpath-'))
  const bundled = makeFakeGitDir(root, path.join('resources', 'mingit', 'cmd'))
  const env = { PATH: path.join(root, 'somewhere-else') }
  const changed = ensureGitOnPath({ env, platform: 'win32', packaged: false, appPath: root })
  assert.equal(changed, true)
  assert.ok(env.PATH.startsWith(bundled))
})

test('does nothing when neither PATH nor the bundle has git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpath-'))
  const env = { PATH: path.join(root, 'nowhere') }
  const changed = ensureGitOnPath({ env, platform: 'win32', packaged: false, appPath: root })
  assert.equal(changed, false)
  assert.equal(env.PATH, path.join(root, 'nowhere'))
})

test('is a no-op off Windows, where MinGit is not bundled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitpath-'))
  makeFakeGitDir(root, path.join('resources', 'mingit', 'cmd'))
  const env = { PATH: path.join(root, 'nowhere') }
  const changed = ensureGitOnPath({ env, platform: 'darwin', packaged: false, appPath: root })
  assert.equal(changed, false)
})
