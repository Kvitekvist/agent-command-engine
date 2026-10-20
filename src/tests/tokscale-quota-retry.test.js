require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const { makeTempDir } = require('./helpers/temp-dir')

// Stub the services registerHandlers touches unconditionally at registration
// time (same pattern as audit-regressions.test.js), so this test only
// exercises the 'tokens:getLiveUsage' quota-retry/persistence logic.
const hooks = require('../main/services/HookService')
hooks.ensureHookFiles = () => ({ dir: makeTempDir('ace-hooks-'), settingsPath: 'hooks.json' })
hooks.watchAgentStatus = () => {}
hooks.watchQuestionnaireRequests = () => {}
hooks.readClaudeQuota = () => null

const { TokscaleService } = require('../main/services/TokscaleService')
TokscaleService.getTodayBreakdown = async () => ({})

function makeDbBackedByStore(store) {
  return {
    getProjects: () => [],
    getSetting: (key) => (key in store ? store[key] : null),
    setSetting: (key, value) => { store[key] = value },
  }
}

function registerAndGetLiveUsage(DB) {
  delete require.cache[require.resolve('../main/ipc/handlers')]
  const { registerHandlers } = require('../main/ipc/handlers')
  const handlers = new Map()
  const ipc = { handle: (key, fn) => handlers.set(key, fn), on: () => {} }
  const window = { isDestroyed: () => false, webContents: { mainFrame: { parent: null } } }
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  const Agent = { setWindow() {}, agents: new Map() }
  const Terminal = { setWindow() {}, sessions: new Map() }
  registerHandlers(ipc, () => window, DB, Agent, Terminal)
  return () => handlers.get('tokens:getLiveUsage')(event)
}

test('Codex quota missing valid data with nothing cached gets one retry', async () => {
  const store = {}
  let calls = 0
  TokscaleService.getCodexQuota = async () => {
    calls++
    // First call: tokscale's Codex-scoped call drops the usage entirely
    // (the observed live flake). Retry: it comes back.
    if (calls === 1) return { usage: null }
    return { usage: { plan: 'Plus', metrics: [{ label: 'Weekly', used_percent: 16 }] } }
  }

  const getLiveUsage = registerAndGetLiveUsage(makeDbBackedByStore(store))
  const result = await getLiveUsage()

  assert.equal(calls, 2)
  assert.equal(result.codex.plan, 'Plus')
  assert.equal(result.codex.quota[0].used_percent, 16)
  // The successful retry is persisted so a future app start can fall back to it.
  assert.equal(JSON.parse(store['tokscale:lastGoodQuota']).codex.plan, 'Plus')
})

test('a persisted Codex quota cache survives a simulated app restart with no retry delay', async () => {
  const store = { 'tokscale:lastGoodQuota': JSON.stringify({ codex: { plan: 'Plus', quota: [{ label: 'Weekly', used_percent: 16 }] } }) }
  let calls = 0
  TokscaleService.getCodexQuota = async () => {
    calls++
    // Codex's live quota stays unavailable; only the persisted cache should
    // satisfy it, with no retry loop, since the in-memory cache was just
    // reset by re-requiring handlers.js (simulating a fresh process).
    return { usage: null }
  }

  const start = Date.now()
  const getLiveUsage = registerAndGetLiveUsage(makeDbBackedByStore(store))
  const result = await getLiveUsage()
  const elapsedMs = Date.now() - start

  assert.equal(calls, 1, 'no retry when the persisted cache already covers the gap')
  assert.ok(elapsedMs < 1000, `expected no retry delay, took ${elapsedMs}ms`)
  assert.equal(result.codex.plan, 'Plus')
  assert.equal(result.codex.quota[0].used_percent, 16)
})

test('Claude quota comes from the statusLine hook file, mapped to Session/Weekly', async () => {
  TokscaleService.getCodexQuota = async () => ({ usage: null })
  hooks.readClaudeQuota = () => ({
    five_hour: { used_percentage: 6, resets_at: '2026-10-20T11:59:59Z' },
    seven_day: { used_percentage: 84, resets_at: '2026-10-22T17:59:59Z' },
  })

  // Codex side already has a cached fallback, so only Claude's path (under
  // test here) is exercised -- no 2s Codex retry wait.
  const store = { 'tokscale:lastGoodQuota': JSON.stringify({ codex: { plan: 'Plus', quota: [{ label: 'Weekly', used_percent: 16 }] } }) }
  const getLiveUsage = registerAndGetLiveUsage(makeDbBackedByStore(store))
  const result = await getLiveUsage()

  assert.deepEqual(result.claude.quota, [
    { label: 'Session', used_percent: 6, resets_at: '2026-10-20T11:59:59Z' },
    { label: 'Weekly', used_percent: 84, resets_at: '2026-10-22T17:59:59Z' },
  ])

  hooks.readClaudeQuota = () => null
})

test('Claude falls back to the persisted cache when the hook file has no quota yet', async () => {
  hooks.readClaudeQuota = () => null
  TokscaleService.getCodexQuota = async () => ({ usage: null })
  const store = {
    'tokscale:lastGoodQuota': JSON.stringify({
      claude: { plan: 'Pro ai', quota: [{ label: 'Session', used_percent: 78 }] },
      codex: { plan: 'Plus', quota: [{ label: 'Weekly', used_percent: 16 }] },
    }),
  }

  const getLiveUsage = registerAndGetLiveUsage(makeDbBackedByStore(store))
  const result = await getLiveUsage()

  assert.equal(result.claude.plan, 'Pro ai')
  assert.equal(result.claude.quota[0].used_percent, 78)
})
