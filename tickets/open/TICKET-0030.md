# TICKET-0030

**Status**

Open

**Type**

Feature

**Priority**

High

---

**Created**

2026-08-09

---

## Description

An agent's interactive terminal session does not survive switching away
from its project and back — re-selecting the project starts a brand-new
`claude`/`codex` process with no scrollback, instead of reconnecting to
the still-running one. The user needs to jump between projects (and
therefore between agents' sessions) without losing them.

---

## Reason

Documented as a known limitation since TICKET-0019 (per-agent embedded
terminal) and flagged again in `project_memory.md`'s Active Priorities as
an open decision: "Decide whether agent terminal sessions need to survive
a project switch — open a follow-up ticket if so." The user has now
confirmed they do need this.

Root cause: `useStore.setActiveProject` resets the `agents` array on every
project switch, which unmounts every `AgentPane`/`AgentTerminal` for the
old project — `AgentTerminal`'s cleanup effect disposes its PTY session on
unmount, actually killing the real CLI process, not just hiding it.
Re-selecting the project re-mounts fresh cards with brand-new sessions.

TICKET-0027 already solved the equivalent problem one level up (switching
*tabs* away from Agents and back) by keeping `AgentView` mounted at all
times and toggling visibility with a CSS class instead of conditionally
rendering it. This ticket applies the same hide-not-unmount pattern one
level deeper: per agent card, keyed by project, instead of per tab.

---

## Implementation Plan

* [x] `useStore.js`: `setActiveProject` no longer clears `agents` — every
      launched agent (across every project visited this session) stays in
      the store for the life of the app, not just the active project's
* [x] `AgentView.jsx`: render every agent in the store, not just the
      active project's — each card wrapped in a `hidden`-toggled div keyed
      on `agent.projectId === activeProject.id`, mirroring `App.jsx`'s
      existing tab-level hide-not-unmount pattern (TICKET-0027). This
      keeps every other project's `AgentTerminal` mounted (and its PTY
      session alive) while only the active project's cards are visible.
* [x] `AgentView.jsx`: empty-state check and the toolbar's default-label
      generator now count only the active project's agents, not the
      global store array
* [x] `AgentView.jsx`/`AgentTerminal.jsx`: updated stale comments claiming
      sessions don't survive a project switch
* [ ] Manual verification: launch an agent in project A, type a follow-up
      prompt so there's real scrollback, switch to project B and back,
      confirm the same session (scrollback intact, no relaunch) is still
      there — same deferred-verification reasoning as TICKET-0024/0025/
      0026/0027/0028/0029 (see Testing)

---

## Files Modified

- `src/renderer/store/useStore.js`
- `src/renderer/views/AgentView.jsx`
- `src/renderer/components/AgentTerminal.jsx` (comment only)

---

## Testing

`npm run build:renderer` and `npm run build:main` both succeed; `npm test`
(11/11 pass, all pre-existing — no automated coverage for this, it's a
store/mount-lifecycle UI behavior, same as TICKET-0027). Manual
verification deferred: this is a renderer-only change that hot-reloads via
Vite HMR, but the user's dev window may have real in-progress agent
sessions on other projects — same reasoning already used for the recent
run of tickets in this milestone.

---

## Result

Implemented. Every agent card, for every project visited this session,
now stays mounted for the life of the app; only visibility toggles on
project switch. A project switch itself no longer disposes any PTY
session — sessions are only torn down by Stop, Delete, or app quit.

Note: this trades a resource cost (every running agent across every
visited project keeps a live PTY/CLI process and xterm instance, even
while its project isn't active) for session continuity, which is exactly
what was asked for. Worth revisiting only if that turns out to matter in
practice (e.g. a user routinely running many agents across many projects
at once).

---

## Notes

Does not change app-restart behavior — sessions still do not survive the
app quitting, since PTY sessions are OS processes owned by `ptyHost.js`,
not something that can be serialized/restored. Only a same-session project
switch is covered here.

---

## Closed

