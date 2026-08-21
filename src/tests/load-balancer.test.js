require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')

const { LoadBalancer } = require('../main/services/LoadBalancer')
const { DBService } = require('../main/services/DBService')

// LoadBalancer reads its inputs off the DBService singleton. Rather than stand
// up a real sql.js database, each test swaps in the exact getSetting/getPrompts
// responses it wants and restores them afterwards.
function withDb({ settings = {}, prompts = [] }, fn) {
  const origSetting = DBService.getSetting
  const origPrompts = DBService.getPrompts
  DBService.getSetting = (key) => (key in settings ? settings[key] : null)
  DBService.getPrompts = () => prompts
  try {
    return fn()
  } finally {
    DBService.getSetting = origSetting
    DBService.getPrompts = origPrompts
  }
}

const minsAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString()

test('a manual provider override always wins, ignoring settings', () => {
  withDb({ settings: { codex_fallback_enabled: 'true' } }, () => {
    assert.equal(LoadBalancer.decide({ manualProvider: 'codex' }), 'codex')
    assert.equal(LoadBalancer.decide({ manualProvider: 'claude' }), 'claude')
  })
})

test('defaults to claude when codex fallback is disabled', () => {
  withDb({ settings: { codex_fallback_enabled: 'false' } }, () => {
    assert.equal(LoadBalancer.decide({}), 'claude')
  })
  // Missing setting is treated the same as disabled.
  withDb({ settings: {} }, () => {
    assert.equal(LoadBalancer.decide({}), 'claude')
  })
})

test('switches to codex when recent claude burn exceeds the threshold', () => {
  withDb(
    {
      settings: { codex_fallback_enabled: 'true', claude_credit_threshold: '100000' },
      prompts: [
        { provider: 'claude', input_tokens: 70000, output_tokens: 40000, created_at: minsAgo(10) },
      ],
    },
    () => {
      assert.equal(LoadBalancer.decide({ projectId: 1 }), 'codex')
    },
  )
})

test('stays on claude when recent burn is under the threshold', () => {
  withDb(
    {
      settings: { codex_fallback_enabled: 'true', claude_credit_threshold: '100000' },
      prompts: [
        { provider: 'claude', input_tokens: 10000, output_tokens: 5000, created_at: minsAgo(10) },
      ],
    },
    () => {
      assert.equal(LoadBalancer.decide({ projectId: 1 }), 'claude')
    },
  )
})

test('only counts claude usage from within the last hour', () => {
  withDb(
    {
      settings: { codex_fallback_enabled: 'true', claude_credit_threshold: '100000' },
      prompts: [
        // Well over threshold, but older than an hour -> must be ignored.
        { provider: 'claude', input_tokens: 500000, output_tokens: 0, created_at: minsAgo(120) },
        // Recent codex usage must not count toward the claude burn.
        { provider: 'codex', input_tokens: 500000, output_tokens: 0, created_at: minsAgo(5) },
      ],
    },
    () => {
      assert.equal(LoadBalancer.decide({ projectId: 1 }), 'claude')
    },
  )
})

test('falls back to the default 100k threshold when the setting is unset', () => {
  withDb(
    {
      settings: { codex_fallback_enabled: 'true' },
      prompts: [
        { provider: 'claude', input_tokens: 120000, output_tokens: 0, created_at: minsAgo(1) },
      ],
    },
    () => {
      assert.equal(LoadBalancer.decide({ projectId: 1 }), 'codex')
    },
  )
})

test('a DBService failure degrades to zero recent usage (stays on claude)', () => {
  const origSetting = DBService.getSetting
  const origPrompts = DBService.getPrompts
  DBService.getSetting = (key) =>
    key === 'codex_fallback_enabled' ? 'true' : null
  DBService.getPrompts = () => {
    throw new Error('db not initialized')
  }
  try {
    assert.equal(LoadBalancer.decide({ projectId: 1 }), 'claude')
  } finally {
    DBService.getSetting = origSetting
    DBService.getPrompts = origPrompts
  }
})
