# TICKET-0013

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-07-22

---

## Description

After reopening the app (or switching projects and back), an agent's
restored conversation history showed only the user's sent messages — the
agent's response messages were missing.

## Reason

`AgentService.sendPrompt`'s stdout handler split each raw `data` chunk on
`\n` independently:

```js
proc.stdout.on('data', (data) => {
  for (const line of data.toString().split('\n')) { ... }
})
```

Node delivers stdout in arbitrary-sized chunks, not one-line-per-chunk. A
single stream-json line — especially the final `result` line, which
carries the entire response text *and* the turn's token usage, making it
often the largest line in the whole stream — can be split across two
`data` events. When that happens, `JSON.parse` throws on both fragments,
which is caught and silently swallowed, so that line's text and token
counts are dropped entirely for that turn.

Live output can still look fine (earlier, shorter lines parse
successfully), but the final consolidated response for the turn goes
missing — which is exactly what gets persisted to `prompts.response_text`
and later replayed by `restoreAgentThread`. This is the same underlying
class of bug that made [[TICKET-0012]]'s token counts unreliable (a split
`result` line also drops that turn's `usage`).

**Second, deeper root cause found during verification of the fix above:**
`DBService`'s `prepare(sql).run()` wrapper calls `save()` (which calls
sql.js's `db.export()`) immediately after every write — and `export()`
resets the connection's `last_insert_rowid()` counter to 0 as a side
effect. `logPrompt` queried `last_insert_rowid()` in a *separate* call
made *after* `run()` (and therefore after `save()`) had already reset it,
so it always got back `0` instead of the real inserted row id.
`agents:sendPrompt`'s handler then called `DB.updatePromptTokens(0, ...)`
on completion — updating a row that never existed — so `response_text`
(and the token/duration columns) were silently never written for *any*
prompt, regardless of the stdout-buffering fix. This alone fully explains
the reported symptom, independent of whether the chunk-buffering fix
above is in place.

Confirmed with a minimal sql.js repro: `last_insert_rowid()` reads `1`
immediately after an insert, but `0` once `db.export()` runs in between.

## Implementation Plan

* [x] Buffer incomplete trailing lines across stdout `data` events instead
      of splitting each chunk in isolation, so a JSON line split across
      chunk boundaries gets reassembled before parsing.
* [x] Flush any remaining buffered (unterminated) line when the process
      closes, so output that doesn't end in a trailing newline isn't lost.
* [x] Read `last_insert_rowid()` inside `prepare().run()` *before* calling
      `save()`, and return it as `lastInsertRowid` on the result instead of
      having `logPrompt` re-query it afterwards.
* [x] Manual verification: reproduced the bug with a standalone DB
      round-trip script (`logPrompt` → `updatePromptTokens` → `getPrompts`)
      — before the fix, `promptId` came back `0` and `response_text`
      stayed `null` after the "update"; after the fix, `promptId` is the
      real row id and `response_text`/token columns persist correctly.
      Also ran `npm run build` (renderer + main) clean, and launched the
      app via `npm run dev` — DB init, window creation, and load all
      completed without error.

## Files Modified

- src/main/services/AgentService.js
- src/main/services/DBService.js

## Testing

- Standalone DB round-trip script confirming `logPrompt`/`updatePromptTokens`
  now write to the correct row (see verification note above).
- `npm run build` (renderer + main) — clean.
- `npm run dev` launch — app boots, DB initializes, window loads, no crash.

## Result

Fixed. Two independent bugs contributed to the same symptom: (1) stdout
chunks weren't reassembled across `data` events, so a split final `result`
line could drop the response text; (2) `DBService` always computed the
wrong `lastInsertRowid` (0) because it read `last_insert_rowid()` after
`db.export()` had already reset it, so `updatePromptTokens` never updated
a real row. Bug (2) alone was sufficient to make every agent response
fail to persist — it is the primary explanation for the reported symptom.

## Notes

Reported by user as: "when i opened the app i only see my sent messages,
not the response messages from the agents." The `AuditView.jsx` detail
panel already had a fallback string, `'(streamed — see agent output)'`,
for when `response_text` is empty — a sign this gap was known about but
worked around rather than fixed at the source. This same `lastInsertRowid`
bug is very likely also the primary cause behind [[TICKET-0012]]'s "Token
Usage tab shows no data" symptom, since `input_tokens`/`output_tokens`
are written by the same `updatePromptTokens` call that was silently
targeting a non-existent row.

---

## Closed

2026-07-22 — Fixed and verified via DB round-trip script + clean build +
dev launch.

