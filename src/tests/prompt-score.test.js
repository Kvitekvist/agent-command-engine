const assert = require('node:assert/strict')
const test = require('node:test')

async function load() {
  return import('../renderer/utils/promptScore.mjs')
}

function row(overrides) {
  return {
    sessionId: 's', client: 'claude', createdAt: Date.now(), models: ['claude-sonnet-5'],
    input: 100, output: 50, cacheRead: 0, cost: 0.01, prompts: 3, durationMinutes: 5,
    firstPromptChars: null, firstPromptWords: null,
    ...overrides,
  }
}

test('median handles even/odd counts and empty input', async () => {
  const { median } = await load()
  assert.equal(median([1, 2, 3]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([]), null)
})

test('splitCurrentPrevious buckets rows into equal-length adjacent windows', async () => {
  const { splitCurrentPrevious } = await load()
  const now = Date.parse('2026-09-18T00:00:00Z')
  const day = 86400000
  const rows = [
    row({ createdAt: now - 1 * day }),      // current
    row({ createdAt: now - 10 * day }),     // previous (within 7-14d ago)
    row({ createdAt: now - 20 * day }),     // outside both
  ]
  const { current, previous } = splitCurrentPrevious(rows, 7, now)
  assert.equal(current.length, 1)
  assert.equal(previous.length, 1)
})

test('splitCurrentPrevious with no range returns everything as current', async () => {
  const { splitCurrentPrevious } = await load()
  const rows = [row(), row()]
  const { current, previous } = splitCurrentPrevious(rows, null)
  assert.equal(current.length, 2)
  assert.equal(previous.length, 0)
})

test('modelCostTiers ranks the cheapest observed model as economy', async () => {
  const { modelCostTiers } = await load()
  const rows = [
    row({ models: ['cheap-model'], input: 1000, output: 0, cacheRead: 0, cost: 0.001 }),
    row({ models: ['mid-model'], input: 1000, output: 0, cacheRead: 0, cost: 0.01 }),
    row({ models: ['pricey-model'], input: 1000, output: 0, cacheRead: 0, cost: 0.05 }),
  ]
  const tiers = modelCostTiers(rows)
  assert.equal(tiers.find((m) => m.model === 'cheap-model').tier, 'economy')
  assert.equal(tiers.find((m) => m.model === 'pricey-model').tier, 'premium')
})

test('computeTokenEfficiencyScore rewards high cache reuse and cheap model mix', async () => {
  const { computeTokenEfficiencyScore } = await load()
  const efficient = [row({ models: ['cheap-model'], input: 10, cacheRead: 990, cost: 0.001 })]
  const wasteful = [row({ models: ['cheap-model'], input: 1000, cacheRead: 0, cost: 0.001 })]
  const good = computeTokenEfficiencyScore(efficient, [])
  const bad = computeTokenEfficiencyScore(wasteful, [])
  assert.ok(good.score > bad.score, `expected ${good.score} > ${bad.score}`)
})

test('computeTokenEfficiencyScore returns null score for no usage', async () => {
  const { computeTokenEfficiencyScore } = await load()
  const result = computeTokenEfficiencyScore([], [])
  assert.equal(result.score, null)
  assert.ok(result.factors.every((f) => f.score == null))
  assert.ok(result.factors.every((f) => f.feedback == null))
})

test('computeTokenEfficiencyScore attaches per-factor feedback with a matching tone', async () => {
  const { computeTokenEfficiencyScore } = await load()
  const efficient = [row({ models: ['cheap-model'], input: 10, cacheRead: 990, cost: 0.001 })]
  const { factors } = computeTokenEfficiencyScore(efficient, [])
  const cacheReuse = factors.find((f) => f.key === 'cacheReuse')
  assert.equal(cacheReuse.feedback.tone, 'good')
  assert.ok(cacheReuse.feedback.message.length > 0)
})

test('promptsPerChatDistribution buckets by prompt count', async () => {
  const { promptsPerChatDistribution } = await load()
  const rows = [row({ prompts: 1 }), row({ prompts: 2 }), row({ prompts: 20 })]
  const dist = promptsPerChatDistribution(rows)
  assert.equal(dist.find((b) => b.label === '1').sessions, 1)
  assert.equal(dist.find((b) => b.label === '2-3').sessions, 1)
  assert.equal(dist.find((b) => b.label === '13+').sessions, 1)
})

test('firstPromptStats only counts sessions with recorded prompt-length data', async () => {
  const { firstPromptStats } = await load()
  const rows = [row({ firstPromptChars: 40, firstPromptWords: 8 }), row()]
  const stats = firstPromptStats(rows)
  assert.equal(stats.count, 1)
  assert.equal(stats.medianChars, 40)
})
