require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./helpers/temp-dir')

const { FileService, RUNNABLE_EXTENSIONS } = require('../main/services/FileService')

// Each test gets its own isolated project root under the OS temp dir.
function makeRoot() {
  return makeTempDir('ace-fileservice-')
}

test('writeFile then readFile round-trips text content', () => {
  const root = makeRoot()
  const file = path.join(root, 'notes.txt')
  assert.deepEqual(FileService.writeFile(root, file, 'hello world'), { ok: true })
  assert.deepEqual(FileService.readFile(root, file), { ok: true, content: 'hello world' })
})

test('readDir lists directories before files, each alphabetized', () => {
  const root = makeRoot()
  fs.writeFileSync(path.join(root, 'b.txt'), '')
  fs.writeFileSync(path.join(root, 'a.txt'), '')
  fs.mkdirSync(path.join(root, 'zdir'))
  fs.mkdirSync(path.join(root, 'adir'))

  const names = FileService.readDir(root, root).map((e) => e.name)
  assert.deepEqual(names, ['adir', 'zdir', 'a.txt', 'b.txt'])
})

test('readFile refuses a file containing null bytes as binary', () => {
  const root = makeRoot()
  const bin = path.join(root, 'data.bin')
  fs.writeFileSync(bin, Buffer.from([0x68, 0x00, 0x69]))
  const result = FileService.readFile(root, bin)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'binary')
})

test('readFile refuses a file larger than the readable limit', () => {
  const root = makeRoot()
  const big = path.join(root, 'huge.txt')
  // Just over the 2 MiB cap.
  fs.writeFileSync(big, Buffer.alloc(2 * 1024 * 1024 + 1, 0x61))
  const result = FileService.readFile(root, big)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'too-large')
})

// TICKET-0021 security guard: no method may touch anything outside its root.
test('every method rejects a path escaping the project root', () => {
  const root = makeRoot()
  const outside = path.join(root, '..', 'escape.txt')
  assert.throws(() => FileService.readFile(root, outside), /outside the project root/)
  assert.throws(() => FileService.writeFile(root, outside, 'x'), /outside the project root/)
  assert.throws(() => FileService.readDir(root, path.join(root, '..')), /outside the project root/)
})

test('a sibling directory sharing a name prefix is not treated as inside the root', () => {
  const parent = makeRoot()
  const root = path.join(parent, 'project')
  fs.mkdirSync(root)
  // "project-evil" starts with "project" but is NOT under "project/".
  const sibling = path.join(parent, 'project-evil', 'secret.txt')
  assert.throws(() => FileService.readFile(root, sibling), /outside the project root/)
})

test('the root itself is a permitted target', () => {
  const root = makeRoot()
  // Resolving the root against itself must not throw.
  assert.doesNotThrow(() => FileService.readDir(root, root))
})

test('runFile refuses an extension that is not runnable on this platform', () => {
  const root = makeRoot()
  const file = path.join(root, 'notes.txt')
  fs.writeFileSync(file, 'echo hi')
  const result = FileService.runFile(root, file)
  assert.equal(result.ok, false)
  assert.match(result.error, /can't be run/)
})

test('rename moves an entry in place and rejects bad names', () => {
  const root = makeRoot()
  const file = path.join(root, 'old.txt')
  fs.writeFileSync(file, 'x')

  const ok = FileService.rename(root, file, 'new.txt')
  assert.equal(ok.ok, true)
  assert.equal(fs.existsSync(path.join(root, 'new.txt')), true)
  assert.equal(fs.existsSync(file), false)

  // A separator would relocate the entry, not just rename it.
  assert.equal(FileService.rename(root, path.join(root, 'new.txt'), 'sub/x.txt').ok, false)
  assert.equal(FileService.rename(root, path.join(root, 'new.txt'), '..').ok, false)

  // Colliding with an existing name is refused, not silently overwritten.
  fs.writeFileSync(path.join(root, 'taken.txt'), 'y')
  assert.match(FileService.rename(root, path.join(root, 'new.txt'), 'taken.txt').error, /already exists/)
})

test('rename rejects a path escaping the project root', () => {
  const root = makeRoot()
  const outside = path.join(root, '..', 'escape.txt')
  assert.throws(() => FileService.rename(root, outside, 'x.txt'), /outside the project root/)
})

test('trash refuses to delete the project root', async () => {
  const root = makeRoot()
  const result = await FileService.trash(root, root)
  assert.equal(result.ok, false)
  assert.match(result.error, /project root/)
})

test('RUNNABLE_EXTENSIONS is the expected per-platform set', () => {
  const expected =
    process.platform === 'win32'
      ? ['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.com', '.msi']
      : ['.sh', '.command', '.app']
  assert.deepEqual([...RUNNABLE_EXTENSIONS].sort(), expected.sort())
})
