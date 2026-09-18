# TICKET-0151: Prompt Score analytics tab

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-18

---

## Description

Add a "Prompt Score" tab to ACE's existing Usage view: user-facing
analytics about how the person uses AI through ACE (first-prompt length,
prompts per chat, tokens per chat, token trends over time, model usage and
cost-tier mix, model preference over time, and a documented Token Efficiency
Score).

---

## Reason

User request: ACE tracks raw token/cost numbers (Token Usage tab) but gives
no behavioral insight (how prompting habits and model choices develop over
time, or whether token spend looks efficient). Investigate what's already
captured before adding new instrumentation, and avoid the TICKET-0083
mistake (building a view on data the interactive path doesn't actually
populate).

---

## Implementation Plan

Data audit first:

* [x] `TokscaleService.getWorkspaceReport` (project-scoped `tokscale report`)
  already returns, per session: `message_count` (prompts), `total_input/
  output/cache_read_tokens`, `total_cost`, `models_used[]`, `created_at`,
  `duration_minutes`. Verified live against the real binary (412 real
  sessions, all fields populated except `title`/`task_category`/`complexity`,
  which need `--summarize`, an LLM call this project deliberately skips).
  This alone covers: prompts/chat, tokens/chat, token trends, model usage +
  trend over time. No new instrumentation needed for these.
* [x] Confirmed `report` also works with no `--workspace` filter (returns
  every session across every project tokscale knows about, matching the
  Usage tab's existing "whole machine" scope). Its Live Usage card already
  aggregates cross-project. Prompt Score uses this, not a per-project
  view, so it needs no active-project selection.
* [x] First-prompt length is genuinely missing (tokscale reports token
  counts, never prompt text). Nothing in ACE currently captures it.
  New instrumentation: a `UserPromptSubmit` Claude Code hook (ACE already
  wires one for the status badge) that reads `prompt` from stdin and appends
  only `{ session_id, chars, words, ts }` to a local JSONL file (never the
  prompt text itself). Forward-only: first-prompt length is available for
  sessions run through ACE from this ticket's release onward, and the UI
  says so rather than implying historical coverage.

Build:

* [x] `TokscaleService.js`: add `getAllSessionsReport(clients)` (same
  per-client `report --json --no-summarize` call as `getWorkspaceReport`,
  without the `--workspace` filter).
* [x] `HookService.js`: `PROMPT_LENGTH_SCRIPT`, wired as a second
  `UserPromptSubmit` command; `readPromptEvents()` parses the JSONL file
  (tolerant of a truncated/corrupt last line).
* [x] `handlers.js`: `tokens:getPromptScore` (merges the global session
  report with prompt-length events, first event per `session_id`, returns
  normalized rows + a `promptLengthTrackedSince` timestamp).
* [x] `preload.js`: `getPromptScore`.
* [x] `src/renderer/utils/promptScore.mjs`: pure aggregation helpers
  (median/percentile, day/week bucketing, per-model cost-tier terciles
  computed from the user's own observed $/1K tokens, Token Efficiency Score)
  with `src/tests/prompt-score.test.js`.
* [x] `src/renderer/views/PromptScoreView.jsx`: new tab (time-range
  picker, Token Efficiency Score gauge + factor breakdown, summary stat
  cards for median prompts/chat, median tokens/chat, first-prompt length,
  token trend chart, prompts-per-chat distribution, model usage +
  cost-tier mix, model mix over time). Loading / empty / insufficient-data /
  error states throughout; first-prompt section explicitly marked
  "tracking started `<date>`" when the JSONL file has no/few events yet.
* [x] `Sidebar.jsx` nav entry, `App.jsx` route.
* [x] `CHANGELOG.md`, node map regenerated.

---

## Files Modified

- `src/main/services/TokscaleService.js`
- `src/main/services/HookService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/utils/promptScore.mjs` (new)
- `src/renderer/views/PromptScoreView.jsx` (new)
- `src/renderer/components/Sidebar.jsx`
- `src/renderer/App.jsx`
- `src/tests/prompt-score.test.js` (new)
- `src/tests/hook-service.test.js`
- `CHANGELOG.md`
- `docs/node-map.html`

---

## Testing

* [x] `npm test` (from `src/`) — 118 passed, 1 skipped (POSIX-only), 0 failed.
  Includes a real spawned-process test of the new prompt-length hook script
  (asserts the prompt text never lands in the events file, only its
  char/word counts) and unit coverage of every `promptScore.mjs` helper.
* [x] `npm run build` — renderer + main build clean.
* [x] Verified `TokscaleService.getAllSessionsReport` live against the real
  tokscale binary during development (412 real sessions, all needed fields
  populated: `message_count`, `total_input/output/cache_read_tokens`,
  `total_cost`, `models_used`, `created_at`, `duration_minutes`).
* [ ] Not yet verified live in the running app: this dev machine's shell has
  `ELECTRON_RUN_AS_NODE=1` set, which breaks `npm run dev` (main process
  loads `electron` as a plain Node module, so `app` is undefined). This is
  unrelated to this change but blocked launching the real GUI from this
  session. Needs a manual check outside that shell: open the new Prompt
  Score tab, confirm the charts and Token Efficiency Score render against
  real history, and that a fresh prompt through an ACE agent shows up in
  First-Prompt Length after a refresh.

---

## Result

Added a whole-machine "Prompt Score" tab (`src/renderer/views/
PromptScoreView.jsx`) covering every metric in the ticket's Description:
token trends, prompts/chat and its distribution, tokens/chat, model usage
and cost-tier mix (and its change over time), and a Token Efficiency Score
with a visible factor breakdown and calculation explanation. All of it reads
real tokscale session data (`TokscaleService.getAllSessionsReport`, no
`--workspace` filter) except first-prompt length, which is new,
forward-only instrumentation: a `UserPromptSubmit` Claude Code hook now
records a submitted prompt's character/word count (never its text) to a
local JSONL file, merged in by `tokens:getPromptScore`. The Token
Efficiency Score (`src/renderer/utils/promptScore.mjs`) blends cache
reuse rate, cost-per-token trend vs. the prior period, and model-mix economy
against the user's own observed per-model rate (no hardcoded pricing table).
Empty, insufficient-data, loading and error states are handled throughout;
the first-prompt section explicitly names the date tracking started rather
than implying historical coverage it doesn't have.

---

## Notes

Token Efficiency Score v1 uses three factors computable from existing
tokscale data (cache reuse rate, cost-per-token trend vs. the prior equal
period, and model-mix economy against the user's own observed per-model
$/1K-token rate). No hardcoded model pricing table, since the catalog's
model lineup and prices are expected to keep changing. Weights live in one
exported constant (`DEFAULT_WEIGHTS`) so they can be retuned later without
touching the calculation logic.

---

## Closed
