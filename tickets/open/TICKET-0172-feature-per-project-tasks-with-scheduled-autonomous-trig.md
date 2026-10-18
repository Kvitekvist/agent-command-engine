# TICKET-0172 — Per-project Tasks list with a scheduled autonomous trigger

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-10-18

---

## Description

Add a per-project Tasks list (same shared-file pattern as Project Notes:
checkbox items instead of free-text notes) plus a project-level schedule:
"run the open tasks automatically in/at X, optionally repeating every Y."
When the schedule fires, ACE spawns a brand-new agent in that project,
autonomous permission mode, and auto-submits the open task list as its
first prompt — no user interaction required. Motivating case: arm it before
a token-limit reset so a backlog of tasks starts working the moment usage
resets.

---

## Reason

Requested directly: a per-project task list like Notes, and the ability to
trigger autonomous work at a future time/interval (e.g. "my tokens reset in
3h54m, start solving tasks then"). Confirmed scope via AskUserQuestion:
project-level schedule (not per-task), fires by spawning + auto-submitting
rather than just notifying, supports both one-shot delay and repeating
interval.

---

## Implementation Plan

* [x] `tasks.mjs` + `TasksService.js` (main): mirror `notes.mjs` /
      `NotesService.js`, JSONL at `.ace/tasks.txt`, fields
      `{ id, timestamp, text, done }`, mutation types `add` / `edit` /
      `delete` / `toggle`.
* [x] `SchedulerService.js` (main): per-project schedule at
      `.ace/schedule.json` (`{ nextRunAt, intervalMinutes }`); `setTimeout`
      per project root, re-armed from all projects on app start (catches up
      immediately if the app was closed past `nextRunAt`). On fire: read
      open tasks, if any, launch a new Claude agent (provider fixed to
      `claude` — it's the one with hook-driven readiness signalling;
      `permissionMode: 'auto'`) with the task list as its prompt; reschedule
      if `intervalMinutes` is set, else clear.
* [x] `HookService.js`: add `registerAutoPrompt(agentId, text)` — the
      existing SessionStart-hook-driven questionnaire-request watcher
      checks this registry first and, if set, writes the prompt straight
      into the PTY (bracketed paste + Enter) instead of notifying the
      renderer. Lets a scheduled run auto-submit its prompt with no
      renderer/UI involvement.
* [x] `handlers.js` / `preload.js`: `tasks:read` / `tasks:mutate`,
      `schedule:read` / `schedule:set` / `schedule:cancel` IPC, wired the
      same way as the existing `notes:*` channels; instantiate
      `SchedulerService` and arm all projects at startup.
* [x] `TasksPanel.jsx` (renderer): mirrors `NotesPanel.jsx` (add/edit/
      delete/undo-delete/search) with a checkbox per task instead of
      "insert into terminal," plus a small schedule bar (delay h/m,
      optional repeat h/m, arm/cancel, next-run countdown).
* [x] `Sidebar.jsx` nav entry + `App.jsx` wiring, matching the `notes` view.
* [x] Tests: `tasks.test.js` (parse/serialize round-trip, mirrors
      `notes.test.js`), `schedule.test.js` (delay/countdown formatting).

---

## Files Modified

- `src/main/services/tasks.mjs` (new)
- `src/main/services/TasksService.js` (new)
- `src/main/services/SchedulerService.js` (new)
- `src/main/services/HookService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/utils/tasks.mjs` (new)
- `src/renderer/utils/schedule.mjs` (new)
- `src/renderer/components/TasksPanel.jsx` (new)
- `src/renderer/components/Sidebar.jsx`
- `src/renderer/App.jsx`
- `src/tests/tasks.test.js` (new)
- `src/tests/schedule.test.js` (new)
- `CHANGELOG.md`

---

## Testing

- `node --test src/tests/tasks.test.js src/tests/schedule.test.js`
- Full suite: `npm test` (see `docs/agents/conventions.md` for the exact
  command).
- Manual: open Tasks on a project, add a couple of tasks, arm a 1-minute
  trigger, confirm a new agent card appears and the CLI receives the task
  list as its first prompt once the CLI finishes booting.

---

## Result

Implemented as planned. `node --test src/tests/*.test.js` (run from `src/`):
162 tests, 161 pass, 1 pre-existing platform skip, 0 failures. Renderer
build (`npm run build:renderer`) succeeds. Not yet manually verified end to
end in the running app (a scheduled fire spawning + auto-submitting into a
real Claude CLI session) — flagging as `Awaiting verification` rather than
`Closed` until that manual check happens.

---

## Notes

Scheduling is scoped to the `claude` provider only (not `codex`) — only
Claude's SessionStart hook signals "the CLI is actually ready for input,"
which the auto-submit depends on. Firing requires ACE itself to be running;
this is not a background/headless service outside the Electron process.

---

## Closed

