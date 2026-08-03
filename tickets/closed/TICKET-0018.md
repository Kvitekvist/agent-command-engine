# TICKET-0018

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-03

---

## Description

Token tracking is unreliable even after TICKET-0012/0013's sql.js fix:

1. Codex agents never get any token data — `sendPrompt` spawns `codex --print`
   with no JSON output mode, but `parseTokens`/`processLine` assume every
   provider emits Claude's `stream-json` shape. Codex lines always fail
   `JSON.parse` and are silently swallowed, so `inputTokens`/`outputTokens`
   stay `0` for the whole agent lifetime.
2. Claude turns undercount real usage — `parseTokens` only reads
   `usage.input_tokens`/`output_tokens` from the CLI's `result` event and
   ignores `cache_creation_input_tokens`/`cache_read_input_tokens`, which
   dominate token counts once prompt caching kicks in.
3. Cost is a hardcoded, hand-maintained `COST_PER_M` table in
   `TokenView.jsx` with no way to stay current with real pricing.

## Reason

User asked to fix token tracking and pointed at a reference project,
`token-monitor` (github.com/Javis603/token-monitor), whose core technique is
not parsing live CLI stdout at all — it shells out to the `tokscale` npm
package, which reads Claude Code's/Codex's own local session transcript
files on disk and returns already-computed, accurate token + cost totals
per session. Verified locally: `npx tokscale --json --client claude --group-by
client,session,model` returns real `input`/`output`/`cacheRead`/`cacheWrite`/
`cost` figures per Claude session id — and that `sessionId` is the exact
same id CPI's `AgentService` already captures via `parseSessionId` from the
Claude CLI's `stream-json` output. That match key makes per-turn
reconciliation straightforward for Claude.

A synchronous per-turn tokscale call was measured at ~1-2s wall time
(process spawn + scan), which is too slow to gate the fast stdout-based
response path users see today. Chosen approach: keep the existing
stdout-parsed numbers for the *instant* prompt-done event (unchanged
responsiveness), then run a tokscale reconciliation pass asynchronously
afterward and correct the DB row once it resolves.

Codex has no equivalent match key: CPI never asks codex to `--resume` a
prior session (each turn is a stateless invocation), so there is no stable
per-agent session id to match against tokscale's codex session rows, and
guessing via "newest codex session file" is unsafe once more than one Codex
agent can run concurrently (this app supports exactly that). Codex token
tracking is out of scope for this ticket — still tracked as a known
limitation, not silently faked.

---

## Implementation Plan

* [x] Add `tokscale` as a dependency; add asarUnpack/files entries for it in
      the electron-builder config so it survives packaging
* [x] `TokscaleService.js`: spawn tokscale's JS shim (`tokscale/bin.js` via
      `ELECTRON_RUN_AS_NODE=1`, mirroring how the reference project resolves
      it inside Electron), grouped `client,session,model`, parse into a map
      keyed by `${client}:${sessionId}`
* [x] `DBService`: add `cache_read_tokens`, `cache_creation_tokens`,
      `cost_usd` columns to `prompts`; thread them through
      `logPrompt`/`updatePromptTokens`/`getTokenStats`
* [x] `AgentService`: track a per-agent tokscale cumulative baseline (reset
      on Clear Context, same lifecycle as the existing lifetime counters);
      after each turn's fast `agent:prompt-done`, kick off an async
      reconciliation against tokscale and emit a follow-up
      `agent:tokens-reconciled` event with the corrected delta + cost
* [x] `handlers.js`: apply the reconciled correction to the right prompt row
      (keep the execution→promptId mapping alive long enough for the async
      correction to land)
* [x] `TokenView.jsx`: prefer real `cost_usd` when present; fall back to the
      static `COST_PER_M` estimate only for rows tokscale never reconciled
      (legacy rows, or Codex); surface cache tokens
* [x] Tests for the new parsing/reconciliation helpers
* [x] Update architecture.md, project_memory.md, CHANGELOG, ticket memory

---

## Files Modified

See commit for this ticket.

---

## Testing

`npm test` (src/tests); manual run against a real `claude` CLI session to
confirm reconciled tokens + cost appear in the Token Dashboard after a
turn completes.

---

## Result

Claude agents now get accurate token/cost data (including cache tokens)
reconciled asynchronously from tokscale's read of Claude Code's own local
session transcripts, without adding latency to the response path. Codex
remains at its pre-existing (inaccurate, effectively always-0) stdout-parsed
numbers — deliberately out of scope; see Reason and Notes. Verified: a real
`tokscale` spawn against this machine's actual Claude Code session history
(confirmed sessionId match with AgentService's own captured session id), a
simulated pre-migration sql.js database run through the schema migration
and updated queries, 9 passing automated tests, and a clean `npm run build`.

---

## Notes

Codex token tracking remains a known gap — see Reason above. A future
ticket could resume codex sessions (giving it a stable id to match against
tokscale) if that becomes worth the complexity.

---

## Closed

2026-08-03

