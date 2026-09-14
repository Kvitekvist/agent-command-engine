const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { makeTempDir } = require('./helpers/temp-dir')
const { providerExecutable } = require('../main/services/ProviderExecutable')

test('Claude resolves native npm and legacy installations in PATH order', () => {
  const root = makeTempDir('ace-claude-')
  const first = path.join(root, 'first')
  const second = path.join(root, 'second')
  const native = path.join(second, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  const legacy = path.join(first, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
  try {
    assert.throws(() => providerExecutable('claude', 'win32', root), /Cannot resolve/)
    fs.mkdirSync(path.dirname(native), { recursive: true })
    fs.writeFileSync(native, '')
    assert.deepEqual(providerExecutable('claude', 'win32', second), [native])
    fs.mkdirSync(path.dirname(legacy), { recursive: true })
    fs.writeFileSync(legacy, '')
    assert.deepEqual(providerExecutable('claude', 'win32', `${first};${second}`), ['node', legacy])
    const standalone = path.join(second, 'claude.exe')
    fs.writeFileSync(standalone, '')
    assert.deepEqual(providerExecutable('claude', 'win32', second), [standalone])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
test('launch literals round-trip through the supported platform shell', async () => {
  const { quoteArg } = await import('../main/services/agentLaunch.mjs')
  const literals = ['space path', "apostrophe's path", '$NOT_A_VARIABLE', '`not-a-command`', '%ACE_QUOTE_TEST%', '$(echo unexpected)']
  const args = [process.execPath, path.join(__dirname, 'helpers/argv-report.cjs'), ...literals]
  const command = (process.platform === 'win32' ? '& ' : '') + args.map(arg => quoteArg(arg, process.platform)).join(' ')
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000 })
    : spawnSync('/bin/bash', ['-c', command], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.deepEqual(JSON.parse(result.stdout), literals)
  if (process.platform === 'win32') {
    const root = makeTempDir('ace-provider-')
    const entry = path.join(root, 'node_modules/@openai/codex/bin/codex.js')
    fs.mkdirSync(path.dirname(entry), { recursive: true })
    fs.copyFileSync(path.join(__dirname, 'helpers/argv-report.cjs'), entry)
    fs.copyFileSync(path.join(__dirname, 'helpers/argv-report.cmd'), path.join(root, 'codex.cmd'))
    const executable = providerExecutable('codex', 'win32', root)
    assert.deepEqual(executable, ['node', entry])
    const command = '& ' + [...executable, ...literals].map(arg => quoteArg(arg, process.platform)).join(' ')
    const throughNode = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000, env: { ...process.env, ACE_QUOTE_TEST: 'MUST_NOT_EXPAND' } })
    assert.equal(throughNode.status, 0, throughNode.stderr)
    assert.deepEqual(JSON.parse(throughNode.stdout), literals)
  }
})
