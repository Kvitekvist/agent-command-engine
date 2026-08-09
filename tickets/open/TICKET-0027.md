# TICKET-0027

**Status**

Open

**Type**

Bug

**Priority**

High

---

**Created**

2026-08-09

---

## Description

Switching tabs away from Agents and back pops up visible console/cmd
windows and re-launches every running agent's CLI session from scratch,
sometimes more than once for the same agent.

---

## Reason

Two stacked causes:

1. **`TerminalService._forkHost()` forks `ptyHost.js` without
   `windowsHide: true`.** `child_process.fork()` defaults to showing a new
   console window on Windows when a console-subsystem executable (`node`)
   is spawned from a windowed (GUI-subsystem) parent like Electron's main
   process — a well-documented Node/Windows behavior, not a node-pty
   issue. This fires once per app launch (and again on any host
   crash/restart).
2. **`AgentView` (and every `AgentTerminal` it renders) is unmounted and
   remounted on every tab switch**, because `App.jsx` renders it
   conditionally (`{activeView === 'agents' && <AgentView />}`).
   `AgentTerminal`'s mount effect always spawns a brand-new PTY session
   (see its own header comment and TICKET-0019/TICKET-0025 Notes, which
   both already flagged this as a known limitation without fixing it) —
   so leaving and returning to the Agents tab kills and re-spawns a real
   shell process for *every* already-running agent, each spawn a fresh
   opportunity for a console window to flash. With several agents running
   (observed live: six, across two projects) this reads as "multiple cmd
   windows opening," and doing it repeatedly on every tab visit reads as
   "the same window triggering more than once."

TICKET-0025 already hid the *visual splash text* this same remount
behavior causes, and explicitly noted in its own Notes that the
underlying respawn-on-every-tab-switch was out of scope there and still
open. This ticket is that follow-up.

---

## Implementation Plan

* [x] Add `windowsHide: true` to `TerminalService._forkHost()`'s `fork()`
      call
* [x] Stop `AgentView` from unmounting on tab switches: `App.jsx` now
      always renders it, toggling visibility with a CSS class (`hidden`)
      instead of conditional mounting — the same hide-not-unmount pattern
      the original standalone `TerminalPanel.jsx` used before TICKET-0019
      replaced it with per-agent terminals. Other views (`AuditView`,
      `TokenView`, `SettingsView`, `EditorView`) are untouched — they
      don't own long-lived OS processes, so there's nothing to preserve
      across a remount for them.
* [x] Confirmed this doesn't change project-switch behavior: `agents` is
      still reset in the zustand store on `setActiveProject`, which still
      unmounts each `AgentPane`/`AgentTerminal` for the old project
      (correctly disposing their sessions) independently of whether
      `AgentView` itself stays mounted
* [ ] Manual verification: launch an agent, switch to another tab and
      back several times, confirm no new console window appears and the
      same terminal session (scrollback intact) is still there instead of
      a fresh CLI launch each time

---

## Files Modified

- `src/main/services/TerminalService.js`
- `src/renderer/App.jsx`

---

## Testing

`npm run build:renderer` / `npm run build:main` (both clean) and `npm test`
(11/11 pass, all pre-existing — no automated coverage for either fix, one
is Windows-process-visibility and the other is a mount-lifecycle/UI
behavior). Manual verification intentionally deferred: the `App.jsx` fix
hot-reloads into an already-running dev window via Vite HMR, but the
`TerminalService.js` fix (like every main-process change in this repo —
see architecture.md's `npm run dev` gotcha) only takes effect after an
actual app restart, and the user's dev window had real in-progress agent
sessions at the time, so a restart wasn't forced — same reasoning
TICKET-0024/0025/0026 already used.

---

## Result

Implemented both fixes described above. Not yet re-verified live end to
end (would require restarting the running app, deferred — see Testing).

App restarted 2026-08-09 ~19:47 (prompted by a user report of "terminal
windows popping up in the background after a while, as if reconnecting" —
the previously-running dev window predated this fix, including a live
Codex agent still using the pre-TICKET-0026 `codex-mini-latest` slug,
confirming it was on stale code). Fresh `npm run dev` came up clean
(`Startup complete`, `PTY host process ready`, no console-window flash
observed). The manual checklist item (launch an agent, switch tabs
several times, confirm no new window + scrollback intact) is now
unblocked but still needs an actual pass with a live agent running.

---

## Notes

Once this lands, TICKET-0025's timed splash-hide only ever fires on a
genuine first launch (or after Stop → relaunch, or a project switch) —
exactly what that ticket's own Notes predicted would happen "if terminal
sessions are ever made to survive a remount."

Does not change the still-open, separately-tracked limitation that a
session does *not* survive a full project switch or app restart — only
that it now survives merely switching which tab is active, which is the
behavior actually being asked for here.

---

## Closed

