# TICKET-0011 — Add a Delete button to stopped agent panes so a user can remove

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-07-19

---

## Description

Add a Delete button to stopped agent panes so a user can remove an agent
from the interface (without touching its audit history), plus a
permission-mode selector (Safe/Guarded/Auto) and restoring agents +
persisted conversation history when a project is (re)selected.

## Reason

Previously, stopped agents had no way to be removed from the UI, and there
was no way to restore the model's conversation across a project switch or
app restart.

## Implementation Plan

* [x] Add 🗑️ Delete button, shown in place of Stop once an agent is stopped
* [x] Add permission-mode selector (Safe / Guarded / Auto) to the launch bar
* [x] Restore agents + replay persisted prompt history on project (re)select
* [x] Fix: `stopAgent()` in AgentView.jsx called `removeAgent()` right after
      stopping, which raced with (and undid) the `agent:status` event that
      correctly flips the card to `'stopped'` in place — the card vanished
      entirely instead of turning into the "Stopped + history + Delete"
      state. Removed the redundant `removeAgent()` call.
* [x] Fix: the project-select restore effect only restored agents whose DB
      status was `'running'`, so a stopped agent (with real persisted
      history) never got its card rebuilt after a project switch or app
      restart — no history, no Delete button, nothing. Now every persisted
      agent is restored regardless of status.
* [ ] Manual verification: stop a running agent, confirm its card stays
      visible with history intact and the Delete button appears; switch
      projects and back, confirm both running and stopped agents reappear
      with history.

## Files Modified

- src/renderer/views/AgentView.jsx
- src/renderer/store/useStore.js
- src/renderer/App.jsx
- src/main/services/AgentService.js
- src/main/services/DBService.js
- src/main/ipc/handlers.js
- src/main/preload.js

## Testing

Manual — see Implementation Plan verification step above (not yet run).

## Result

(pending manual verification)

## Notes

Reported by user as "I don't see my message history, nor do I see a
remove button" after stopping an agent — traced to the two bugs listed
above.

---

## Closed

