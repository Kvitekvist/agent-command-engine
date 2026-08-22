require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  DEFAULT_MODEL_BY_PROVIDER,
  normalizeProvider,
  resolveLaunchPolicy,
} = require('../main/services/LaunchPolicy')

function resolve(input, { selected = 'claude', settings = {} } = {}) {
  return resolveLaunchPolicy(input, {
    decideProvider: ({ manualProvider }) => manualProvider || selected,
    getSetting: (key) => settings[key] ?? null,
  })
}

test('normalizes Auto to no manual provider and rejects unknown providers', () => {
  assert.equal(normalizeProvider('auto'), null)
  assert.equal(normalizeProvider(null), null)
  assert.equal(normalizeProvider('claude'), 'claude')
  assert.throws(() => normalizeProvider('other'), /Unsupported provider/)
})

test('manual provider and selected model are preserved', () => {
  assert.deepEqual(resolve({ provider: 'codex', model: 'gpt-5.6-sol', projectId: 4 }), {
    provider: 'codex', model: 'gpt-5.6-sol', automatic: false,
  })
})

test('manual provider uses its saved default model when no model is supplied', () => {
  const result = resolve({ provider: 'claude' }, {
    settings: { default_provider: 'claude', default_model: 'claude-opus-5' },
  })
  assert.equal(result.model, 'claude-opus-5')
})

test('Auto resolves a provider-compatible model after routing', () => {
  const result = resolve({ provider: 'auto', model: 'claude-opus-5' }, {
    selected: 'codex',
    settings: { default_provider: 'claude', default_model: 'claude-opus-5' },
  })
  assert.deepEqual(result, {
    provider: 'codex', model: DEFAULT_MODEL_BY_PROVIDER.codex, automatic: true,
  })
})

test('provider defaults are used when saved settings belong to another provider', () => {
  const result = resolve({ provider: 'codex' }, {
    settings: { default_provider: 'claude', default_model: 'claude-opus-5' },
  })
  assert.equal(result.model, DEFAULT_MODEL_BY_PROVIDER.codex)
})

test('corrupt saved settings do not block a valid manual launch', () => {
  const result = resolve({ provider: 'claude' }, {
    settings: { default_provider: 'other', default_model: 'wrong-model' },
  })
  assert.equal(result.model, DEFAULT_MODEL_BY_PROVIDER.claude)
})
