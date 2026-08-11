const assert = require('node:assert/strict')
const test = require('node:test')

const { toUsageMap, sessionKey, rowTokenTotal, shortenWorkspace } = require('../main/services/TokscaleService')

// Sample shape verified against a real `tokscale --json --client claude
// --group-by client,session,model` invocation.
test('parses tokscale entries into a per-session usage map', () => {
  const json = {
    groupBy: 'client,session,model',
    entries: [
      {
        client: 'claude', sessionId: 'session-1', model: 'claude-sonnet-5', provider: 'anthropic',
        input: 100, output: 50, cacheRead: 900, cacheWrite: 40, cost: 0.75,
      },
      {
        client: 'claude', sessionId: 'session-2', model: 'claude-opus-4-8', provider: 'anthropic',
        input: 10, output: 5, cacheRead: 0, cacheWrite: 0, cost: 0.05,
      },
    ],
    totalInput: 110, totalOutput: 55, totalCacheRead: 900, totalCacheWrite: 40, totalCost: 0.8,
  }

  const map = toUsageMap(json)
  assert.deepEqual(map.get(sessionKey('claude', 'session-1')), {
    inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheCreationTokens: 40, costUsd: 0.75,
  })
  assert.deepEqual(map.get(sessionKey('claude', 'session-2')), {
    inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0.05,
  })
})

test('sums multiple model rows belonging to the same session', () => {
  const json = {
    entries: [
      { client: 'claude', sessionId: 's', model: 'claude-sonnet-5', input: 10, output: 5, cacheRead: 100, cacheWrite: 10, cost: 0.1 },
      { client: 'claude', sessionId: 's', model: 'claude-opus-4-8', input: 20, output: 15, cacheRead: 200, cacheWrite: 20, cost: 0.2 },
    ],
  }

  const map = toUsageMap(json)
  assert.deepEqual(map.get(sessionKey('claude', 's')), {
    inputTokens: 30, outputTokens: 20, cacheReadTokens: 300, cacheCreationTokens: 30, costUsd: 0.30000000000000004,
  })
})

test('ignores rows missing a client or session id, and malformed input', () => {
  assert.equal(toUsageMap(null).size, 0)
  assert.equal(toUsageMap({}).size, 0)
  assert.equal(toUsageMap({ entries: [{ model: 'x', input: 5 }] }).size, 0)
})

test('rowTokenTotal excludes reasoning tokens to avoid double-counting (TICKET-0022)', () => {
  assert.equal(rowTokenTotal({ input: 10, output: 5, cacheRead: 100, cacheWrite: 20, reasoning: 999 }), 135)
  assert.equal(rowTokenTotal({}), 0)
})

test('shortenWorkspace reduces a dashed project key to its leaf folder (TICKET-0042)', () => {
  assert.equal(shortenWorkspace('C--Users-JensPetterR-yseth-Documents-VS-Code-ACE'), 'ACE')
  assert.equal(shortenWorkspace('ACE'), 'ACE')
  assert.equal(shortenWorkspace(''), 'unknown')
  assert.equal(shortenWorkspace(undefined), 'unknown')
  // Trailing separator must not yield an empty label.
  assert.equal(shortenWorkspace('foo-bar-'), 'bar')
})
