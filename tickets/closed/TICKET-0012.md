# TICKET-0012

**Status**

Closed

**Type**

Bug

**Priority**

Medium

**Created**

2026-07-22

---

## Description

The Token Usage tab shows no data (or wildly wrong totals once an agent has
sent more than one prompt).

## Reason

`AgentService.sendPrompt` tracks `agent.inputTokens` / `agent.outputTokens`
as **lifetime** counters on the agent (only reset by "Clear Context"), but
on every turn's `close` event it reported those lifetime totals as if they
were *that turn's* tokens:

```js
this._emit('agent:prompt-done', {
  ...
  tokens: { input: agent.inputTokens, output: agent.outputTokens },
})
```

`handlers.js` then writes that number onto the single `prompts` row for the
turn that just finished. `TokenView`/`getTokenStats` sums `input_tokens`
across all rows for a day, so each additional turn's row double-counts
every prior turn's tokens on top of its own — the reported totals grow
superlinearly with turn count instead of reflecting the real usage.

Separately, `parseTokens` added usage from *both* the `assistant` stream
event and the final `result` event for the same turn, double-counting
within a single turn on top of the above.

**Third, and likely the dominant cause of "shows no data" specifically:**
found while investigating [[TICKET-0013]]. `DBService.logPrompt` computed
`lastInsertRowid` by querying `last_insert_rowid()` *after* `run()` had
already called `save()` (sql.js `db.export()`), which resets that counter
to 0 as a side effect. So `updatePromptTokens(0, { input_tokens, ... })`
was always updating a non-existent row — `input_tokens`/`output_tokens`
never actually reached a real `prompts` row, no matter what value
`AgentService` reported. That alone accounts for the tab showing no data;
the lifetime-vs-delta bug above would only have shown up as "wildly
wrong" *if* the values had been landing in the DB at all.

## Implementation Plan

* [x] Snapshot the agent's lifetime token counters at the start of each
      turn in `sendPrompt`, and report only the turn's delta via
      `agent:prompt-done` (keeps the per-turn DB row accurate while
      preserving the lifetime total used by the "Tokens — in/out" summary
      shown when an agent is stopped).
* [x] Stop reading token usage from `assistant` stream events in
      `parseTokens` — only the final `result` event's `usage` is
      authoritative for the turn.
* [x] Fix `DBService` to read `last_insert_rowid()` before `save()` runs
      (see [[TICKET-0013]]), so `updatePromptTokens` targets the real row.
* [x] Manually verify: standalone DB round-trip script confirms
      `input_tokens`/`output_tokens` written via `updatePromptTokens` now
      show up correctly in both `getPrompts` and `getTokenStats`.

## Files Modified

- src/main/services/AgentService.js
- src/main/services/DBService.js

## Testing

Standalone DB round-trip script: logged a prompt, updated it with
`input_tokens: 123, output_tokens: 456`, and confirmed `getTokenStats`
returned `total_input: 123, total_output: 456, total_tokens: 579` for the
correct row — previously these all stayed `0` because the update targeted
a nonexistent row id.

Live multi-turn compounding behavior (via the real Claude CLI) still
hasn't been exercised end-to-end — that would need a real `claude` CLI
session, which isn't available in this environment. The delta-tracking
logic in `AgentService.sendPrompt` (snapshot lifetime counters at turn
start, report only the delta) was re-checked by static reading and looks
correct, but flag this if per-turn totals still look off in practice.

## Result

Fixed. The dominant cause of "Token Usage tab shows no data" was the
shared `DBService` `lastInsertRowid` bug (see [[TICKET-0013]]), not the
lifetime-vs-delta mixup alone — that mixup would only have surfaced once
values were actually reaching the DB. Both are now fixed.

## Notes

Reproducing against the real Claude CLI's stream-json output wasn't
possible in this session (no live CLI session available), so the
lifetime-vs-delta fix in `AgentService` is verified by static analysis of
the parsing/aggregation logic rather than an end-to-end run. The DB-layer
fix, which turned out to matter more, is verified directly.

---

## Closed

2026-07-22 — Fixed and verified via DB round-trip script; live per-turn
compounding behavior not re-verified end-to-end (no real CLI session
available in this environment).

