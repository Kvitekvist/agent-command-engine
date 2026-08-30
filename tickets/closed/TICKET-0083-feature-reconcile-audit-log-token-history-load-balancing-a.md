# TICKET-0083 — Reconcile Audit Log, Token History, Load Balancing, and Optimization

**Status**

Closed

**Type**

Enhancement

**Priority**

High

**Created**

2026-08-22

---

## Description

Reconcile Audit Log, Token History, Load Balancing, and Optimization Advisor
with ACE's canonical interactive terminal agent path.

## Reason

Audit and optimization still consume the legacy headless `prompts` table,
which interactive terminals do not populate. User-facing analytics must either
use real interactive-session data or be removed rather than presenting stale
historical results as current functionality.

## Implementation Plan

Resolved by **removal**, not rebuild. Audit Log and the Optimization Advisor
had no value to reconstruct — they answered questions about a data set ACE
stopped collecting in TICKET-0019. Token History already reads live tokscale
data (`tokens:getProjectHistory`) and was left untouched. The Load Balancing
credit-pressure heuristic read the same dead table, so it always saw zero
burn and always returned Claude — collapsed to that behaviour explicitly.

* [x] ~~Define provider-neutral interactive session and turn telemetry~~ — not needed; tokscale already supplies live per-session usage
* [x] ~~Map provider transcripts to ACE agents~~ — already done by `agent_sessions` (TICKET-0044)
* [x] Remove Audit Log and Optimization Advisor instead of rebuilding them
* [x] Remove obsolete headless-only APIs and persistence: `prompts` table,
      `agents:sendPrompt` / `agents:clearContext` IPC, `AgentService.sendPrompt` /
      `_reconcileTokens` / `clearContext`, and the `prompts`-backed DB methods
* [x] Collapse `LoadBalancer.decide` to `manualProvider || 'claude'`

## Files Modified

- `src/main/services/DBService.js` — drop `prompts` CREATE + migrations, add
  `DROP TABLE IF EXISTS prompts`, remove `logPrompt` / `updatePromptTokens` /
  `updatePromptUsage` / `getPrompts` / `getPromptById` / `getTokenStats` /
  `getProjectTokenSummary` / `clearAgentHistory`; drop `codex_fallback_enabled`
  and `claude_credit_threshold` seeds and the TICKET-0084 threshold repair
- `src/main/services/AgentService.js` — remove `sendPrompt`, `_reconcileTokens`,
  `_seedTokscaleBaseline`, `clearContext`, `createExecutionId`, the stream
  parsers (`parseTokens` / `parseText` / `parseToolUse` / `parseSessionId` /
  `parsePermissionDenials`), `computeTokscaleDelta`, and the `TokscaleService`
  import; trim `restore()` and the exports
- `src/main/services/LoadBalancer.js` — gut the `prompts`-backed burn-rate
  heuristic; `decide` returns `manualProvider || 'claude'`
- `src/main/services/OptimizationAdvisor.js` — deleted
- `src/main/ipc/handlers.js` — remove `agents:sendPrompt`, `agents:clearContext`,
  the `agent:prompt-done` / `agent:tokens-reconciled` DB listeners, `inFlight`,
  `prompts:get`, `prompts:getById`, `tokens:getStats`, `optimize:analyze`, and
  the `OptimizationAdvisor` import
- `src/main/preload.js` — remove `getPrompts`, `getPromptById`, `getTokenStats`,
  `getOptimizationAdvice`, `sendPrompt`, `clearContext`, and the unused
  `onAgentOutput` / `onAgentPromptDone` / `onAgentToolUse` bridges (+ `off*`)
- `src/renderer/views/AuditView.jsx` — deleted
- `src/renderer/App.jsx`, `src/renderer/components/Sidebar.jsx` — drop the
  Audit Log route and nav entry
- `src/renderer/store/useStore.js` — remove `auditPrompts` / `optimizationResult`
- `src/renderer/views/SettingsView.jsx` — remove the Load Balancing and Token
  Optimization Advisor sections; "Auto" help text now says it routes to Claude
- `src/renderer/views/TokenView.jsx` — comment fixups
- `src/tests/optimization-advisor.test.js` — deleted
- `src/tests/load-balancer.test.js`, `src/tests/agent-service.test.js` — trimmed
  to the surviving surface
- `CHANGELOG.md`, `docs/agents/current-state.md` — updated

## Testing

* [x] `npm test` — 58 passed, 1 skipped (POSIX-only), 0 failed
* [x] `npm run build` — renderer + main build clean
* [ ] ~~Live verification with both providers~~ — no behavioural surface left
      to verify; the removed views/APIs had no live callers

## Result

Audit Log, Optimization Advisor, and the Load Balancing heuristic are gone.
Token History (live tokscale data) is unchanged. The `prompts` table is
dropped on next launch. "Auto" provider routing resolves to Claude.

## Notes

Coordinate with TICKET-0076 and TICKET-0080. — Both closed in the same
2026-08-30 triage; no coordination needed.

## Closed

2026-08-30
