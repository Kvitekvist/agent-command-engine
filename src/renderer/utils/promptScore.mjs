// TICKET-0151: pure aggregation helpers for the Prompt Score tab. Kept
// framework-free so they're directly unit-testable (see
// prompt-score.test.js). PromptScoreView.jsx only shapes their
// output into charts.
//
// Row shape (from `tokens:getPromptScore`):
//   { sessionId, client, createdAt, models: [id,...], input, output,
//     cacheRead, cost, prompts, durationMinutes, firstPromptChars, firstPromptWords }

export function median(nums) {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function totalTokens(row) {
  return (row.input || 0) + (row.output || 0) + (row.cacheRead || 0)
}

// Rows within the last `days` (createdAt is epoch ms). `days === null` means
// all-time (returns every row).
export function filterByRange(rows, days, now = Date.now()) {
  if (days == null) return rows
  const cutoff = now - days * 86400000
  return rows.filter((r) => Number(r.createdAt) >= cutoff)
}

// `current` = last `days`; `previous` = the equal-length window immediately
// before it. Used for the Token Efficiency Score's cost trend factor and for
// "vs. previous period" comparisons. All-time has no meaningful "previous",
// so `days === null` returns an empty previous window.
export function splitCurrentPrevious(rows, days, now = Date.now()) {
  if (days == null) return { current: rows, previous: [] }
  const cutoff = now - days * 86400000
  const prevCutoff = cutoff - days * 86400000
  return {
    current: rows.filter((r) => Number(r.createdAt) >= cutoff),
    previous: rows.filter((r) => Number(r.createdAt) >= prevCutoff && Number(r.createdAt) < cutoff),
  }
}

function bucketKey(ts, unit) {
  const d = new Date(Number(ts))
  if (unit === 'week') {
    // Monday-anchored ISO-ish week key, good enough for a chart axis label.
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
  }
  return d.toLocaleDateString('en-CA')
}

// Aggregates rows into { day/week, input, output, cacheRead, cost, prompts,
// tokens, sessions } buckets, sorted chronologically. `unit` is 'day' or 'week'.
export function bucketByTime(rows, unit = 'day') {
  const map = new Map()
  for (const r of rows) {
    if (!Number.isFinite(Number(r.createdAt))) continue
    const key = bucketKey(r.createdAt, unit)
    const b = map.get(key) || { bucket: key, input: 0, output: 0, cacheRead: 0, cost: 0, prompts: 0, tokens: 0, sessions: 0 }
    b.input += r.input || 0
    b.output += r.output || 0
    b.cacheRead += r.cacheRead || 0
    b.cost += r.cost || 0
    b.prompts += r.prompts || 0
    b.tokens += totalTokens(r)
    b.sessions += 1
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

// Per-model totals, splitting a multi-model session's tokens/cost evenly
// across its models. Tokscale reports session totals, not a per-model
// breakdown within a session, and multi-model sessions are rare (a manual
// mid-session model switch). ponytail: even split, revisit with a weighted
// split if tokscale ever exposes per-message model attribution.
export function modelTotals(rows) {
  const map = new Map()
  for (const r of rows) {
    const models = r.models && r.models.length ? r.models : ['unknown']
    const share = 1 / models.length
    for (const m of models) {
      const b = map.get(m) || { model: m, tokens: 0, cost: 0, sessions: 0 }
      b.tokens += totalTokens(r) * share
      b.cost += (r.cost || 0) * share
      b.sessions += share
      map.set(m, b)
    }
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens)
}

// List prices, $ per 1M tokens [input, output]. Update when Anthropic's
// pricing changes. Matched by the longest key contained in the id, so ids like
// claude-opus-4-5-20251101 resolve and claude-opus-5-5 doesn't hit
// claude-opus-5. ponytail: current Claude + GPT-6/5.6 only; others fall back to their
// observed blended rate, which swings with cache use (cheap reads pull it
// down; cache writes aren't counted as tokens but are in the cost, pushing it up).
const LIST_PRICES = {
  'claude-fable-5-1': [10, 50],
  'claude-fable-5': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-opus-4-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-4-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
  // OpenAI (Codex). Dots become dashes before matching: gpt-5.6-terra -> gpt-5-6-terra.
  'gpt-6-astra': [10, 50],
  'gpt-6-sol': [2, 10],
  'gpt-6-luna': [0.1, 0.5],
  'gpt-5-6-sol': [4, 20],
  'gpt-5-6-terra': [2, 12],
  'gpt-5-6-luna': [0.2, 1.2],
}

// The standard workload each model is priced on: 100k in + 700 out.
const REFERENCE_IN = 100_000
const REFERENCE_OUT = 700

export function listPrice(model) {
  // Tolerate tokscale-style spellings: "haiku-4.5", "anthropic/claude-haiku-4-5".
  const id = String(model).toLowerCase().replace(/\./g, '-')
  const key = Object.keys(LIST_PRICES)
    .filter((k) => id.includes(k.replace(/^claude-/, '')))
    .sort((a, b) => b.length - a.length)[0]
  return key ? LIST_PRICES[key] : null
}

// Tiers are relative: ranked by reference cost, the cheapest 20% are economy,
// the priciest 30% premium, the rest balanced. Equal prices share a tier.
export function modelCostTiers(rows) {
  const totals = modelTotals(rows).map((m) => {
    const rate = m.tokens > 0 ? m.cost / (m.tokens / 1000) : 0
    const price = listPrice(m.model)
    const referenceCost = price
      ? (REFERENCE_IN * price[0] + REFERENCE_OUT * price[1]) / 1e6
      : rate * ((REFERENCE_IN + REFERENCE_OUT) / 1000)
    return { ...m, rate, referenceCost }
  })
  // Counting strictly cheaper / strictly pricier models keeps a price tie
  // (e.g. every $5/$25 Opus) in one tier instead of splitting it by sort order.
  const n = totals.length
  const tierOf = (m) => {
    const cheaper = totals.filter((o) => o.referenceCost < m.referenceCost).length
    const pricier = totals.filter((o) => o.referenceCost > m.referenceCost).length
    const economy = cheaper < 0.2 * n
    const premium = pricier < 0.3 * n
    return economy === premium ? 'balanced' : economy ? 'economy' : 'premium'
  }
  const tierByModel = new Map(totals.map((m) => [m.model, tierOf(m)]))
  return totals.map((m) => ({ ...m, tier: tierByModel.get(m.model) }))
}

export function modelMixByTier(rows) {
  const tiers = modelCostTiers(rows)
  const totalTok = tiers.reduce((s, m) => s + m.tokens, 0)
  const byTier = { economy: 0, balanced: 0, premium: 0 }
  for (const m of tiers) byTier[m.tier] = (byTier[m.tier] || 0) + m.tokens
  return ['economy', 'balanced', 'premium'].map((tier) => ({
    tier, tokens: byTier[tier], pct: totalTok > 0 ? (byTier[tier] / totalTok) * 100 : 0,
  }))
}

const TIER_WEIGHT = { economy: 1, balanced: 0.5, premium: 0 }

// Per-factor coaching copy, keyed by score tier (good >=70, fair >=40, low
// otherwise — same cutoffs the UI already uses to color the score). This is
// what turns the raw factor score into "here's what to actually do."
const FACTOR_FEEDBACK = {
  cacheReuse: {
    good: 'Strong cache reuse — context is staying cached instead of being resent.',
    fair: 'Moderate cache reuse. Continuing an existing session (instead of starting a new one) keeps more context cached.',
    low: 'Low cache reuse. Continue existing sessions rather than starting fresh ones so unchanged context stays cached.',
  },
  costTrend: {
    good: '$/1K tokens is trending down versus the prior period.',
    fair: '$/1K tokens is roughly flat versus the prior period.',
    low: '$/1K tokens is trending up. Check whether a pricier model is being used for tasks a cheaper one could handle.',
  },
  modelMix: {
    good: 'Most tokens go to your lowest-cost models for the work being done.',
    fair: 'Token spend is split across cost tiers. Consider shifting simple or repetitive tasks to cheaper models.',
    low: "Most tokens go to your priciest models. Consider a cheaper model for tasks that don't need the top tier.",
  },
}

function feedbackFor(key, score) {
  if (score == null) return null
  const tone = score >= 70 ? 'good' : score >= 40 ? 'fair' : 'low'
  return { tone, message: FACTOR_FEEDBACK[key][tone] }
}

export const DEFAULT_WEIGHTS = { cacheReuse: 0.5, costTrend: 0.3, modelMix: 0.2 }

// Token Efficiency Score, 0-100. Three factors, each already computable from
// tokscale's existing per-session data (no new instrumentation):
//
//  1. Cache reuse rate (default 50%): cacheRead / (input + cacheRead).
//     The most directly controllable lever: staying in one session and not
//     re-sending unchanged context.
//  2. Cost trend (default 30%): this period's $/1K total tokens vs. the
//     immediately preceding equal-length period. Self-relative on purpose,
//     since there's no external "efficient $/token" benchmark to compare against.
//  3. Model mix economy (default 20%): share of tokens spent on the user's
//     own cheapest-tercile models (see modelCostTiers) vs. priciest. Only a
//     fifth of the score, since using an expensive model for a hard task is
//     often the *correct* choice, not an inefficiency.
//
// Weights are one exported constant so they can be retuned later without
// touching this function.
export function computeTokenEfficiencyScore(currentRows, previousRows = [], weights = DEFAULT_WEIGHTS) {
  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0)

  const cacheRead = sum(currentRows, 'cacheRead')
  const input = sum(currentRows, 'input')
  const cacheReuseScore = (cacheRead + input) > 0 ? clamp((cacheRead / (cacheRead + input)) * 100) : null

  const curTokens = currentRows.reduce((s, r) => s + totalTokens(r), 0)
  const curCost = sum(currentRows, 'cost')
  const prevTokens = previousRows.reduce((s, r) => s + totalTokens(r), 0)
  const prevCost = sum(previousRows, 'cost')
  let costTrendScore = null
  let costTrendDetail = 'No prior period to compare yet.'
  if (curTokens > 0 && prevTokens > 0 && prevCost > 0) {
    const curRate = curCost / (curTokens / 1000)
    const prevRate = prevCost / (prevTokens / 1000)
    const pctChange = (curRate - prevRate) / prevRate
    costTrendScore = clamp(50 - pctChange * 100)
    costTrendDetail = `$/1K tokens ${pctChange <= 0 ? 'down' : 'up'} ${Math.abs(pctChange * 100).toFixed(0)}% vs. the prior period.`
  }

  const mix = modelMixByTier(currentRows)
  const totalMixTokens = mix.reduce((s, m) => s + m.tokens, 0)
  const modelMixScore = totalMixTokens > 0
    ? clamp(mix.reduce((s, m) => s + m.tokens * TIER_WEIGHT[m.tier], 0) / totalMixTokens * 100)
    : null

  const factors = [
    { key: 'cacheReuse', label: 'Cache reuse', weight: weights.cacheReuse, score: cacheReuseScore, detail: cacheReuseScore == null ? 'No usage in this period.' : `${cacheReuseScore.toFixed(0)}% of context tokens were cache reads.`, feedback: feedbackFor('cacheReuse', cacheReuseScore) },
    { key: 'costTrend', label: 'Cost trend', weight: weights.costTrend, score: costTrendScore, detail: costTrendDetail, feedback: feedbackFor('costTrend', costTrendScore) },
    { key: 'modelMix', label: 'Model mix economy', weight: weights.modelMix, score: modelMixScore, detail: modelMixScore == null ? 'No usage in this period.' : `${mix.find((m) => m.tier === 'economy')?.pct.toFixed(0) || 0}% of tokens on your lowest-cost models.`, feedback: feedbackFor('modelMix', modelMixScore) },
  ]

  const scored = factors.filter((f) => f.score != null)
  const weightSum = scored.reduce((s, f) => s + f.weight, 0)
  const score = weightSum > 0 ? Math.round(scored.reduce((s, f) => s + f.score * f.weight, 0) / weightSum) : null

  return { score, factors }
}

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

// Fixed, human-readable buckets. Simpler and more legible on a chart axis
// than a computed histogram for a metric with this small a typical range.
const PROMPT_COUNT_BUCKETS = [
  { label: '1', test: (n) => n === 1 },
  { label: '2-3', test: (n) => n >= 2 && n <= 3 },
  { label: '4-6', test: (n) => n >= 4 && n <= 6 },
  { label: '7-12', test: (n) => n >= 7 && n <= 12 },
  { label: '13+', test: (n) => n >= 13 },
]

export function promptsPerChatDistribution(rows) {
  return PROMPT_COUNT_BUCKETS.map((b) => ({
    label: b.label,
    sessions: rows.filter((r) => b.test(Number(r.prompts) || 0)).length,
  }))
}

export function firstPromptStats(rows) {
  const withData = rows.filter((r) => Number.isFinite(r.firstPromptChars))
  return {
    count: withData.length,
    medianChars: median(withData.map((r) => r.firstPromptChars)),
    medianWords: median(withData.map((r) => r.firstPromptWords)),
  }
}

// Median first-prompt length per time bucket, for the "development over
// time" trend. Only over sessions that actually carry the (forward-only)
// prompt-length data.
export function firstPromptTrend(rows, unit = 'day') {
  const withData = rows.filter((r) => Number.isFinite(r.firstPromptChars) && Number.isFinite(Number(r.createdAt)))
  const map = new Map()
  for (const r of withData) {
    const key = bucketKey(r.createdAt, unit)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r.firstPromptChars)
  }
  return [...map.entries()]
    .map(([bucket, chars]) => ({ bucket, medianChars: median(chars) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
}
