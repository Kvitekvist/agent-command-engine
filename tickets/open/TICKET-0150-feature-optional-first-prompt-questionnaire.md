# TICKET-0150 — Optional first-prompt questionnaire on session start/clear

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

For Claude agents, offer an optional popup questionnaire that helps the user
compose their first prompt: one-line topic, general description, things to
avoid/include, and what "done" looks like. It appears when a Claude session
starts fresh or the user runs `/clear` (driven by a real Claude Code
`SessionStart` hook, not app-side guessing), with Send (submits the composed
prompt) and Skip (dismisses, no-op) buttons. Toggleable off entirely from
Settings.

---

## Reason

User request: a structured prompt-composition step reduces vague first
prompts and gives Claude usable scope/constraints/done-criteria up front,
without forcing it — anyone who prefers typing directly can skip or disable
it.

---

## Implementation Plan

* [x] `HookService.js`: new `session-start.js` hook script — reads stdin
  JSON, checks `source`/`session_start_reason` for `startup`/`clear`, checks
  a `.questionnaire-disabled` marker, writes a one-shot request file into a
  new watched `questionnaire/` dir keyed by `session_id`. Wired as a
  `SessionStart` entry in the generated hook settings (no matcher — the
  script itself filters, since matcher support for this field is not
  reliably documented).
* [x] `watchQuestionnaireRequests(DB, getWindow)` in `HookService.js`,
  mirroring `watchAgentStatus`: maps `session_id` → `agentId`, forwards
  `agent:questionnaireRequest`, deletes the request file after forwarding.
* [x] `handlers.js`: call the new watcher; extend `settings:set` to
  toggle the `.questionnaire-disabled` marker for key
  `first_prompt_questionnaire_enabled`.
* [x] `preload.js`: expose `onQuestionnaireRequest`.
* [x] `AgentTerminal.jsx`: subscribe (Claude agents only), show a `Modal`
  with the four fields, Send composes the prompt and pastes + submits it
  into the PTY, Skip just closes it.
* [x] `SettingsView.jsx`: General-tab checkbox for
  `first_prompt_questionnaire_enabled` (default on).
* [x] New pure util `firstPromptQuestionnaire.mjs` (compose the four fields
  into one prompt string) with a matching test.
* [x] Extend `hook-service.test.js` for the new hook entry/script.
* [x] `CHANGELOG.md`, node map.

---

## Files Modified

- `src/main/services/HookService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/views/SettingsView.jsx`
- `src/renderer/utils/firstPromptQuestionnaire.mjs` (new)
- `src/tests/hook-service.test.js`
- `src/tests/first-prompt-questionnaire.test.js` (new)
- `CHANGELOG.md`
- `docs/node-map.html`

---

## Testing

- `node --test tests/*.test.js` (from `src/`): 108 passed, 1 skipped
  (POSIX-only), 0 failed. Includes the new `first-prompt-questionnaire.test.js`
  and the extended `hook-service.test.js` SessionStart assertions.
  `audit-regressions.test.js`'s IPC harness also now stubs
  `watchQuestionnaireRequests` the same way it already stubbed
  `watchAgentStatus` -- the real implementation's `fs.watch` otherwise keeps
  that test's process alive past exit.
- `npm run build` (renderer + main): passed.
- Not yet verified live: launching a fresh Claude agent and running `/clear`
  inside one, confirming the popup appears, Send submits a composed prompt,
  Skip dismisses, and the Settings toggle suppresses it.

---

## Result

Claude agents now get an optional popup on a fresh session or `/clear`,
sourced from a real `SessionStart` Claude Code hook (`HookService.js`'s new
`session-start.js` script, filtering `startup`/`clear` itself rather than
relying on `matcher`) rather than app-side guessing -- it also catches the
user typing `/clear` by hand, not just a dedicated button. The hook drops a
one-shot request file that `watchQuestionnaireRequests` forwards to the
owning agent's `AgentTerminal`, which shows a `Modal` with the four fields;
Send composes them (`firstPromptQuestionnaire.mjs`) and submits through
xterm's bracketed paste + a real Enter, Skip just closes it. A Settings
checkbox (`first_prompt_questionnaire_enabled`, on by default) toggles a
`.questionnaire-disabled` marker the standalone hook script checks directly,
the same pattern as the existing notification-sound mute marker.

---

## Notes

`ponytail:` the hook fires on every `SessionStart` (no matcher) and filters
`source` in the script itself, since pipe-alternation matcher support for
this specific field isn't reliably documented across CLI versions — upgrade
to a matcher if that's ever confirmed stable.

---

## Closed

---
