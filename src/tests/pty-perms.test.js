// TICKET-0068: regression coverage for the PTY / agent-terminal spawn fix from
// TICKET-0066. Two things broke agent creation on macOS/Linux and are covered
// here without needing node-pty or Electron installed:
//   1. node-pty's native `spawn-helper` losing its executable bit ->
//      fix-pty-perms restores +x. Exercised against a temp fake node-pty tree.
//   2. the opaque "posix_spawnp failed" error -> ptyHost's describeSpawnError
//      appends an actionable fix hint (POSIX only).
const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { makeTempDir } = require('./helpers/temp-dir')

const { chmodExec, findSpawnHelpers } = require('../scripts/fix-pty-perms')
const { describeSpawnError } = require('../main/ptyHost')

// Builds a throwaway directory tree mimicking node-pty's on-disk layout, with
// `spawn-helper` binaries under both prebuilds/<platform> and build/Release
// (the two locations findSpawnHelpers is meant to cover), plus decoy files.
function makeFakePtyTree() {
  const root = makeTempDir('ace-pty-')
  const prebuild = path.join(root, 'prebuilds', 'darwin-arm64')
  const release = path.join(root, 'build', 'Release')
  fs.mkdirSync(prebuild, { recursive: true })
  fs.mkdirSync(release, { recursive: true })

  const helperA = path.join(prebuild, 'spawn-helper')
  const helperB = path.join(release, 'spawn-helper')
  // Simulate the bug: helpers written WITHOUT the executable bit.
  fs.writeFileSync(helperA, 'binary', { mode: 0o644 })
  fs.writeFileSync(helperB, 'binary', { mode: 0o644 })
  // Decoys that must NOT be picked up.
  fs.writeFileSync(path.join(prebuild, 'node-pty.node'), 'x', { mode: 0o644 })
  fs.writeFileSync(path.join(root, 'spawn-helper.txt'), 'x', { mode: 0o644 })

  return { root, helperA, helperB }
}

function isExecutable(file) {
  return (fs.statSync(file).mode & 0o111) !== 0
}

test('findSpawnHelpers locates every spawn-helper in the tree and ignores decoys', () => {
  const { root, helperA, helperB } = makeFakePtyTree()
  try {
    const found = findSpawnHelpers(root).sort()
    assert.deepEqual(found, [helperA, helperB].sort())
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('findSpawnHelpers returns empty for a missing directory (no throw)', () => {
  assert.deepEqual(findSpawnHelpers(path.join(os.tmpdir(), 'ace-does-not-exist-xyz')), [])
})

// The actual TICKET-0066 regression: a spawn-helper without +x is what made
// posix_spawnp fail. Restoring the bit is what unblocks agent creation.
test('chmodExec restores the executable bit lost from spawn-helper', {
  skip: process.platform === 'win32' ? 'Windows does not expose POSIX executable bits' : false,
}, () => {
  const { root, helperA, helperB } = makeFakePtyTree()
  try {
    assert.equal(isExecutable(helperA), false)
    for (const helper of findSpawnHelpers(root)) {
      assert.equal(chmodExec(helper), true)
    }
    assert.equal(isExecutable(helperA), true)
    assert.equal(isExecutable(helperB), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('chmodExec returns false for a nonexistent file instead of throwing', () => {
  assert.equal(chmodExec(path.join(os.tmpdir(), 'ace-nope-spawn-helper')), false)
})

test('describeSpawnError appends the fix hint on a POSIX posix_spawnp failure', () => {
  const out = describeSpawnError('posix_spawnp failed.', 'darwin')
  assert.match(out, /posix_spawnp failed\./)
  assert.match(out, /spawn-helper is likely not executable/)
  assert.match(out, /fix-pty-perms\.js/)
})

test('describeSpawnError leaves unrelated errors untouched', () => {
  assert.equal(describeSpawnError('cwd does not exist', 'linux'), 'cwd does not exist')
})

// Windows uses ConPTY and has no spawn-helper, so the POSIX hint must never be
// added there even if the word posix_spawnp somehow appears.
test('describeSpawnError does not add the POSIX hint on Windows', () => {
  assert.equal(describeSpawnError('posix_spawnp failed.', 'win32'), 'posix_spawnp failed.')
})
