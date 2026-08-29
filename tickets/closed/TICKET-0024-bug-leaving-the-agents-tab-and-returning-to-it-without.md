# TICKET-0024 — Leaving the Agents tab and returning to it (without switching projects)

**Status**

Open

**Type**

Bug

**Priority**

High

**Created**

2026-08-09

---

## Description

Leaving the Agents tab and returning to it (without switching projects)
produces duplicate agent cards — including a second real terminal/CLI
process for the same agent, visible as two identical cards (e.g. "Ingrid",
"Anton") side by side.

---

## Reason

`AgentView.jsx`'s restore `useEffect` (keyed on `activeProject?.id`)
fetches every persisted agent row for the active project from the DB and
calls `addAgent()` unconditionally on every mount. `App.jsx` renders
`AgentView` conditionally (`{activeView === 'agents' && <AgentView />}`),
so switching tabs away and back unmounts/remounts `AgentView` and reruns
this effect — but `agents` lives in the Zustand store, not component
state, and is only cleared on a project switch (`setActiveProject`), not
a tab switch. The effect had no guard against re-adding agents already
present in the store, so every return trip to the tab appended a second
copy of each row. For a running agent this is worse than a visual
duplicate: the second store entry mounts a second `AgentTerminal`, which
spawns a brand-new PTY session and re-launches the CLI, so two real
terminal processes exist for what the user sees as one agent.

---

## Implementation Plan

* [x] Guard the restore effect in `AgentView.jsx` to skip any row whose
      `agentId` already exists in the store's `agents` array
* [ ] Manually verify: launch an agent, switch to Token Usage tab, switch
      back to Agents — exactly one card, one terminal
* [x] Update architecture.md / ticket memory

---

## Files Modified

- `src/renderer/views/AgentView.jsx`

---

## Testing

`npm run build:renderer` (clean build) and `npm test` (11/11 pass, all
pre-existing). Live manual verification (switch tabs away/back with a
running agent present, confirm no duplicate card or second terminal
process) is still open — the user's dev window had real in-progress
agent sessions on another project when this was fixed, so it wasn't
driven via automation to avoid disrupting that live work. Vite's dev
server (HMR) was already running, so the fix should apply to that window
without a restart; the user can confirm by switching tabs there.

---

## Result

Root cause: `AgentView.jsx`'s restore `useEffect` re-fetched and
unconditionally re-added every persisted agent row on every mount, but
`App.jsx` renders `AgentView` conditionally so a tab switch away and back
remounts it while the Zustand `agents` array (not component state)
still holds what a prior mount already added — producing duplicate
cards, and for a running agent, a second real `AgentTerminal` mount that
spawned a second PTY session and re-launched the CLI. Fixed by skipping
any row whose `agentId` is already present in the store before adding it.

---

## Notes

Live in-app verification intentionally deferred — see Testing.

---

## Closed

