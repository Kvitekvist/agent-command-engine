const test = require('node:test')
const assert = require('node:assert/strict')
const { prepareRelease } = require('../../scripts/prepare-release')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { makeTempDir } = require('./helpers/temp-dir')

test('release helper leaves a real temporary repository unchanged on dirty input and package failure', () => {
  const root = makeTempDir('ace-release-safety-')
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init')
  fs.writeFileSync(path.join(root, 'reviewed.txt'), 'reviewed')
  git('add', 'reviewed.txt')
  git('-c', 'user.name=ACE test', '-c', 'user.email=ace-test@example.invalid', 'commit', '-m', 'fixture')
  const sha = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(root, 'unrelated.txt'), 'keep me')
  assert.throws(() => prepareRelease(root, sha), /clean working tree/)
  assert.equal(fs.readFileSync(path.join(root, 'unrelated.txt'), 'utf8'), 'keep me')
  // Move the fixture outside this temporary repo, preserving its bytes.
  fs.renameSync(path.join(root, 'unrelated.txt'), root + '-unrelated.txt')
  assert.throws(() => prepareRelease(root, sha, (command, args, options) => {
    if (command === 'git') return spawnSync(command, args, options)
    return { status: args.includes('package') ? 1 : 0, stderr: 'forced package failure' }
  }), /forced package failure/)
  assert.equal(git('rev-parse', 'HEAD'), sha)
  assert.equal(git('tag'), '')
  assert.equal(git('status', '--porcelain'), '')
})
test('release refuses dirty work and stops before publishing on a package failure', () => {
  const sha = 'a'.repeat(40)
  const calls = []
  const run = (command, args) => {
    calls.push([command, ...args])
    if (args[0] === 'rev-parse') return { status: 0, stdout: sha }
    if (args[0] === 'status') return { status: 0, stdout: ' M unrelated.txt' }
    throw new Error('Must not build with unrelated dirty files')
  }
  assert.throws(() => prepareRelease(process.cwd(), sha, run), /clean working tree/)
  assert.equal(calls.length, 2)
  calls.length = 0
  assert.throws(() => prepareRelease(process.cwd(), sha, (command, args) => {
    calls.push([command, ...args])
    if (args[0] === 'rev-parse') return { status: 0, stdout: sha }
    return { status: args.includes('package') ? 1 : 0, stdout: '', stderr: args.includes('package') ? 'forced package failure' : '' }
  }), /forced package failure/)
  assert.equal(calls.some(args => args.some(arg => ['add', 'commit', 'push', 'tag', 'merge'].includes(arg))), false)
})
