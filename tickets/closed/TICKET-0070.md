# TICKET-0070

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-22

---

## Description

On macOS, agent terminals stopped working after the app window was closed and
reopened: every new terminal failed (`posix_spawnp failed` / host unavailable)
until the whole app was restarted. Windows/Linux were unaffected.

---

## Reason

`app.on('window-all-closed')` called `TerminalService.shutdown()`, which kills
the forked PTY host and latches `isShuttingDown = true` with no path to revive
it. On macOS, closing the window does NOT quit the app (standard platform
behavior), so the process kept running with a permanently dead host; reopening
the window via `activate` recreated the BrowserWindow but never restarted the
host or re-pointed the services at the new window. On Windows/Linux the app
quits outright on `window-all-closed`, so the dead host never mattered.

---

## Implementation Plan

* [x] Move service teardown (`AgentService.killAll` + `TerminalService.shutdown`)
  to a guarded `before-quit` handler that runs only when the app is actually
  quitting.

* [x] `window-all-closed` now only quits on non-darwin; on macOS it leaves the
  app and its live PTY host running.

* [x] `activate` re-points `AgentService`/`TerminalService` at the recreated
  window via `setWindow`, so IPC events don't target a destroyed window.

---

## Files Modified

- src/main/index.js

---

## Testing

- `node --check src/main/index.js` passes; `npm run build:main` copies to dist.
- Manual: close the window and reopen (dock/Cmd-Tab), then create a terminal —
  it starts a shell instead of erroring.

---

## Result

Fixed. Terminals survive a window close/reopen cycle on macOS.

---

## Notes

Committed together with the tokscale project-cost and app-icon work in
d6c3f78 ("Terminal fix cond, project cost and app icon fix"); this ticket
documents the lifecycle change specifically. Related: [[TICKET-0066]] (the
original spawn-helper terminal fix).

---

## Closed

2026-08-22
