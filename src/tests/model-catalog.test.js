const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('unset, empty and filtered model preferences have distinct launch choices', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../renderer/utils/modelCatalog.js'))
  const { MODEL_GROUPS_BY_PROVIDER, filterGroupsByEnabled } = await import('data:text/javascript;base64,' + source.toString('base64'))
  for (const groups of Object.values(MODEL_GROUPS_BY_PROVIDER)) {
    assert.deepEqual(filterGroupsByEnabled(groups, null), groups)
    assert.deepEqual(filterGroupsByEnabled(groups, new Set()), [])
    const model = groups.at(-1).options.at(-1).id
    assert.deepEqual(filterGroupsByEnabled(groups, new Set([model])).flatMap(group => group.options.map(option => option.id)), [model])
  }
})

test('discovered CLI models join the catalog in a leading group, known ids are not duplicated', async () => {
  const os = require('node:os')
  const { discoverModels } = require('../main/services/ModelDiscovery')
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-models-'))
  fs.mkdirSync(path.join(home, '.claude/cache/model-catalog'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'))
  fs.writeFileSync(path.join(home, '.claude/cache/model-catalog/x-cc.json'), JSON.stringify({ catalog: { config: { models: [
    { id: 'claude-opus-9', name: 'Opus 9', description: 'New' },
    { id: 'claude-sonnet-5', name: 'Sonnet 5' },
  ] } } }))
  fs.writeFileSync(path.join(home, '.codex/models_cache.json'), JSON.stringify({ models: [
    { slug: 'gpt-9-b', display_name: 'GPT-9-B', visibility: 'list', priority: 2 },
    { slug: 'gpt-9-a', display_name: 'GPT-9-A', visibility: 'list', priority: 1 },
    { slug: 'internal', visibility: 'hide', priority: 0 },
  ] }))
  const found = discoverModels(home, {})
  assert.deepEqual(found.codex.map(m => m.id), ['gpt-9-a', 'gpt-9-b'])
  assert.deepEqual(discoverModels(path.join(home, 'missing'), {}), { claude: [], codex: [] })

  const source = fs.readFileSync(path.join(__dirname, '../renderer/utils/modelCatalog.js'))
  const { getModelGroups, MODEL_GROUPS_BY_PROVIDER } = await import('data:text/javascript;base64,' + source.toString('base64'))
  const groups = getModelGroups('claude', found)
  assert.deepEqual(groups[0], { label: 'New from CLI', options: [{ id: 'claude-opus-9', label: 'Claude Opus 9', description: 'New' }] })
  assert.equal(groups.length, MODEL_GROUPS_BY_PROVIDER.claude.length + 1)
  assert.deepEqual(getModelGroups('claude', null), MODEL_GROUPS_BY_PROVIDER.claude)
})

test('enterprise-gateway logins without a catalog cache still surface their pinned models', async () => {
  const os = require('node:os')
  const { discoverModels } = require('../main/services/ModelDiscovery')
  // Shape seen on a gateway (SSO/JWT) login: no .claude/cache/model-catalog at
  // all, models pinned in settings.json's env block.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-models-gateway-'))
  fs.mkdirSync(path.join(home, '.claude'))
  fs.writeFileSync(path.join(home, '.claude/settings.json'), JSON.stringify({ env: {
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-5',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-8',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5@20251001',
  } }))
  const found = discoverModels(home, { ANTHROPIC_MODEL: 'claude-sonnet-5', ANTHROPIC_DEFAULT_OPUS_MODEL: '  ' })
  assert.deepEqual(found.claude.map(m => m.id), ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5@20251001'])
  assert.match(found.claude[0].description, /ANTHROPIC_MODEL/)

  // Only ids ACE doesn't already list become "New from CLI".
  const source = fs.readFileSync(path.join(__dirname, '../renderer/utils/modelCatalog.js'))
  const { getModelGroups } = await import('data:text/javascript;base64,' + source.toString('base64'))
  assert.deepEqual(getModelGroups('claude', found)[0].options.map(o => o.id), ['claude-haiku-4-5@20251001'])
})

// The work-PC /model menu behind an enterprise gateway (value -> resolvedModel).
const GATEWAY_MODELS = [
  { value: 'default', resolvedModel: 'claude-opus-4-8', displayName: 'Default (recommended)', description: 'Opus 4.8' },
  { value: 'opus', resolvedModel: 'claude-opus-4-8', displayName: 'Opus', description: 'Opus 4.8' },
  { value: 'opus[1m]', resolvedModel: 'claude-opus-5-5[1m]', displayName: 'Opus (1M context)', description: 'Opus 5.5' },
  { value: 'sonnet', resolvedModel: 'claude-sonnet-5-5', displayName: 'Sonnet 5.5' },
  { value: 'claude-sonnet-5', resolvedModel: 'claude-sonnet-5', displayName: 'Sonnet 5' },
  { value: 'claude-sonnet-4-6[1m]', displayName: 'Sonnet 4.6 (1M context)' },
  { value: 'haiku', resolvedModel: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
  { value: 'claude-opus-5-5', displayName: 'Opus 5.5' },
  { value: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
]

test('the /model list from the CLI initialize response becomes concrete, de-duplicated ids', () => {
  const { modelsFromInitialize } = require('../main/services/ModelDiscovery')
  const models = modelsFromInitialize(GATEWAY_MODELS)
  assert.deepEqual(models.map(m => m.id), ['claude-opus-4-8', 'claude-opus-5-5[1m]', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-sonnet-4-6[1m]', 'claude-haiku-4-5', 'claude-opus-5-5'])
  assert.deepEqual(models[1], { id: 'claude-opus-5-5[1m]', label: 'Claude Opus (1M context)', description: 'Opus 5.5' })
  // "Default" counts only when it points at a model nothing else lists.
  assert.deepEqual(modelsFromInitialize([{ value: 'default', resolvedModel: 'claude-x-1', displayName: 'Default (recommended)' }]).map(m => m.id), ['claude-x-1'])
  assert.deepEqual(modelsFromInitialize(null), [])
})

function fakeCli(lines, { exitWithoutAnswer = false } = {}) {
  const { EventEmitter } = require('node:events')
  const calls = []
  const spawnFn = (cmd, args) => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.kill = () => { child.killed = true }
    child.stdin = { on() {}, end: (input) => {
      calls.push({ cmd, args, input })
      setImmediate(() => {
        // Split mid-line to prove stdout is buffered by newline.
        const text = lines.map(l => JSON.stringify(l)).join('\n') + '\n'
        child.stdout.emit('data', text.slice(0, 25))
        child.stdout.emit('data', text.slice(25))
        if (exitWithoutAnswer) child.emit('close', 1)
      })
    } }
    return child
  }
  return { spawnFn, calls }
}

test('listClaudeModels sends initialize and reads the matching control response', async () => {
  const { listClaudeModels } = require('../main/services/ModelDiscovery')
  const { spawnFn, calls } = fakeCli([
    { type: 'system', subtype: 'hook_started' },
    { type: 'control_response', response: { subtype: 'success', request_id: 'other', response: { models: [{ value: 'claude-wrong' }] } } },
    { type: 'control_response', response: { subtype: 'success', request_id: 'ace-models', response: { models: GATEWAY_MODELS } } },
  ])
  const models = await listClaudeModels({ resolve: () => ['claude.exe'], spawnFn })
  assert.equal(models.length, 7)
  assert.deepEqual(calls[0].args, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence'])
  assert.deepEqual(JSON.parse(calls[0].input), { type: 'control_request', request_id: 'ace-models', request: { subtype: 'initialize' } })

  // No answer (older CLI, logged out) or no CLI at all: null, so callers fall back.
  assert.equal(await listClaudeModels({ resolve: () => ['claude.exe'], spawnFn: fakeCli([{ type: 'result' }], { exitWithoutAnswer: true }).spawnFn }), null)
  assert.equal(await listClaudeModels({ resolve: () => { throw new Error('missing') } }), null)
  assert.equal(await listClaudeModels({ resolve: () => ['claude.exe'], spawnFn: fakeCli([]).spawnFn, timeoutMs: 20 }), null)
})

test('refresh runs each CLI silently and survives a missing one; newModels lists only dropdown additions', async () => {
  const { refreshCliCaches } = require('../main/services/ModelDiscovery')
  const calls = []
  await refreshCliCaches({
    resolve: p => { if (p === 'codex') throw new Error('not installed'); return ['claude.exe'] },
    run: (cmd, args, opts, cb) => { calls.push([cmd, args, opts.windowsHide]); cb(new Error('offline')) },
  })
  assert.deepEqual(calls, [['claude.exe', ['-p', '/cost', '--no-session-persistence'], true]])

  const source = fs.readFileSync(path.join(__dirname, '../renderer/utils/modelCatalog.js'))
  const { newModels } = await import('data:text/javascript;base64,' + source.toString('base64'))
  const opus9 = { id: 'claude-opus-9', label: 'Claude Opus 9', description: '' }
  const next = { claude: [opus9, { id: 'claude-sonnet-5', label: 'x', description: '' }], codex: [] }
  assert.deepEqual(newModels(null, next), { claude: [opus9], codex: [] })
  assert.deepEqual(newModels(next, next), { claude: [], codex: [] })
})
