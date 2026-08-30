const assert = require('node:assert/strict')
const test = require('node:test')

const { LoadBalancer } = require('../main/services/LoadBalancer')

test('a manual provider override always wins', () => {
  assert.equal(LoadBalancer.decide({ manualProvider: 'codex' }), 'codex')
  assert.equal(LoadBalancer.decide({ manualProvider: 'claude' }), 'claude')
})

test('Auto (no manual provider) resolves to claude', () => {
  assert.equal(LoadBalancer.decide({}), 'claude')
  assert.equal(LoadBalancer.decide(), 'claude')
})
