const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { makeTempDir } = require('./helpers/temp-dir')

let installed = false
try { require.resolve('vite'); installed = true } catch (_) {}

test('renderer import failure rejects the installed Vite build', { skip: !installed && 'Run after npm ci' }, async () => {
  const root = makeTempDir('ace-build-failure-')
  fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="/entry.js"></script>')
  fs.writeFileSync(path.join(root, 'entry.js'), 'import "./deliberately-missing-renderer.jsx"')
  const { build } = await import('vite')
  await assert.rejects(build({ configFile: false, root, logLevel: 'silent', build: { write: false } }), /missing-renderer/)
})

test('a failing unit assertion makes the test command fail', () => {
  const root = makeTempDir('ace-unit-failure-')
  const file = path.join(root, 'intentional.test.js')
  fs.writeFileSync(file, "require('node:test')('intentional failure', () => require('node:assert/strict').equal(1, 2))")
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', windowsHide: true, env })
  assert.equal(result.status, 1)
})
