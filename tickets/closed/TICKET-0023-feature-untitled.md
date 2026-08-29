# TICKET-0023

**Status**

Closed

**Type**

Feature

**Priority**

Low

---

**Created**

2026-08-09

---

## Description

Add a small quota bar at the top of the Agents tab showing, at a glance,
remaining % of Claude's and Codex's subscription quota and when each next
resets — without needing to switch to the Token Usage tab.

---

## Reason

User wants to see remaining budget while actually launching/watching
agents, not just on the separate Token Usage tab. The data already exists
(TICKET-0022's `tokens:getLiveUsage` IPC call via tokscale) — this is a
compact second presentation of the same live quota data, not new plumbing.

---

## Implementation Plan

* [x] Lift `liveUsage` polling out of `TokenView.jsx` and into `useStore.js`
      (`liveUsage` state + a `loadLiveUsage`/refresh action), so Agents and
      Token Usage share one 60s poll instead of each view spawning its own
      `tokscale` subprocess call independently — the store slice already
      existed from a prior pass in this cycle; `TokenView.jsx` just hadn't
      been switched over to it yet
* [x] Start the shared poll once at the `App.jsx` level so the bar has data
      immediately on the Agents tab without first visiting Token Usage
* [x] Add `src/renderer/components/UsageBar.jsx` — one slim row per
      provider (icon, remaining %, a thin mini progress bar, reset
      countdown for the primary quota metric), reusing `UsageCard.jsx`'s
      format/reset helpers rather than duplicating them (`formatReset`,
      `METRIC_LABELS` exported from there instead of copied)
* [x] Render `<UsageBar />` above the existing toolbar in `AgentView.jsx`
      (also above the "select a project" empty state, since live quota is
      whole-machine data, not project-scoped)
* [x] Update `TokenView.jsx` to read `liveUsage` from the store instead of
      local state (kept its own "Refresh" button, now wired to the shared
      `loadLiveUsage` action)
* [x] Update architecture.md, project_memory.md, ticket_memory.md, README,
      CHANGELOG
* [x] Manual verification, driven live against the app's real running
      window (not a fresh launch — see Notes): confirmed the bar renders
      above the Agents toolbar with real data (Claude 99% used/1%
      available/resets in 1h 20m, Codex 0% used/100% available/resets in
      6d 19h), matching the Token Usage tab's own numbers, with several
      real running agent cards underneath unaffected

---

## Files Modified

- src/renderer/store/useStore.js
- src/renderer/App.jsx
- src/renderer/components/UsageBar.jsx (new)
- src/renderer/views/AgentView.jsx
- src/renderer/views/TokenView.jsx

---

## Testing

`npm run build:renderer` (clean) and `npm test` (11/11 passing, unchanged —
this ticket touched no main-process code). Manual verification: see
Implementation Plan checklist above.

---

## Result

Implemented as planned. `UsageBar.jsx` renders one compact row per provider
(icon, mini progress bar, "`X`% used", "`Y`% available", "resets in `Z`")
above the Agents tab's toolbar, sourced from the same `liveUsage` store
slice the Token Usage tab's full `UsageCard` pair already used — both now
share one 60s poll started once from `App.jsx` instead of each view
spawning its own `tokscale` subprocess call. Token Usage tab itself is
visually unchanged, only its data source moved from local state to the
shared store slice. Verified live against real quota data and real running
agents.

---

## Notes

Found the app already running with two full instances momentarily during
verification (an old one from earlier in this session, port 5173, and a
fresh `npm run dev` this ticket's work accidentally started, which
defaulted to port 5174 but had its Electron side hard-wait on the
already-occupied 5173 — so it just opened a second window onto the *same*
old vite server instead of loading anything new). Both instances pointed
at the same on-disk SQLite database, a real corruption risk per
architecture.md's sql.js `db.export()`-on-every-write gotcha. Killed only
the newly-spawned process tree by PID and verified this change instead
against the pre-existing window (which already had the new code live via
Vite HMR) rather than risk a second concurrent instance. No project skill
for launching this app exists yet — worth generating one
(`/run-skill-generator`) so the next session doesn't have to rediscover
this the same way.

---

## Closed

2026-08-09
