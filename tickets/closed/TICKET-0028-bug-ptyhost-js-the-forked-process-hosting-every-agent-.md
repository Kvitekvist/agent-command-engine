# TICKET-0028 — `ptyHost.js` (the forked process hosting every agent's live PTY

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

`ptyHost.js` (the forked process hosting every agent's live PTY session)
crashed with a native access violation (exit code 3221225477 /
0xC0000005) while the user was switching between projects. Every live
terminal session it was hosting died with it; each affected agent card
was left showing "terminal process was lost -- stop and relaunch this
agent to start a new session" (TerminalService's `terminal:hostRestarted`
event, see TICKET-0019/0025). `TerminalService._startHost()` did correctly
detect the crash and restart the host process, but there is no way to
reattach the sessions that were running inside the crashed one.

---

## Reason

Switching the active project resets the `agents` array in the zustand
store to `[]` (`useStore.js` `setActiveProject`), which unmounts every
`AgentTerminal` for the old project's running agents in the same React
commit. Each one's cleanup effect calls `window.cpi.terminal.dispose(id)`,
which is a fire-and-forget `ipcRenderer.send('terminal:dispose', ...)`
(`preload.js`) -- so with more than one agent running, the forked
`ptyHost.js` process receives several `dispose` messages back-to-back and
calls `proc.kill()` on multiple separate node-pty/ConPTY sessions in
rapid succession (`ptyHost.js` `disposeSession`).

This is a known crash class for node-pty's native ConPTY addon on
Windows: tearing down more than one ConPTY session concurrently/in close
succession races inside the native module. `disposeSession` previously
fired `proc.kill()` and returned immediately with no coordination between
overlapping teardowns, so nothing prevented this.

Only reproduced once so far (user confirmed: happened while "navigating
between projects", one occurrence, not yet seen to recur) -- treating as
a real architectural race given how directly the trigger matches a known
node-pty/ConPTY failure mode, not as a coincidence.

---

## Implementation Plan

* [x] Serialize `ptyHost.js`'s session teardown: `disposeSession` now
      queues onto a shared promise chain and waits for the killed
      session's own `onExit` (with a timeout fallback) before letting the
      next queued disposal call `proc.kill()`, so the native module never
      has two ConPTY teardowns in flight at once.
* [x] `gracefulShutdown` (full host shutdown) now awaits the same queue
      before the process exits, instead of firing every `kill()`
      synchronously and exiting before any of them completed.
* [ ] Manual verification: run multiple agents in one project, switch to
      a different project, confirm no host crash and no
      `terminal:hostRestarted` event.

---

## Files Modified

- `src/main/ptyHost.js`

---

## Testing

`npm run build:main` (clean) and `npm test`. Manual verification (running
several agents, switching projects, confirming no crash) still open --
the original crash was only observed once and isn't reliably reproducible
on demand.

---

## Result

Serialized `ptyHost.js`'s session teardown behind a promise queue that
waits for each killed session's own `onExit` (1500ms timeout fallback)
before the next queued `kill()` runs, so the native ConPTY addon never
sees two teardowns in flight at once. `gracefulShutdown` (full host exit)
now awaits that same queue before calling `process.exit(0)`, instead of
firing every `kill()` synchronously and exiting before any of them had
actually completed. Verified via a clean `npm run build:main` and the
full automated test suite (11/11 pass, no new coverage -- this is
native-process teardown timing, not something the existing JS-level
tests exercise). Live manual verification (run several agents, switch
projects, confirm no crash) still open -- the original crash isn't
reliably reproducible on demand.

---

## Notes

Root cause is inferred from the crash's timing (it occurred immediately
after startup, right as the user was navigating between projects with
presumably more than one agent running) and node-pty's documented
Windows/ConPTY concurrency issues, not from a captured crash dump --
Windows Error Reporting had no matching entry for this process at the
time it happened. If the host crashes again after this fix, the
concurrent-teardown theory is likely wrong and the native crash needs
deeper investigation (e.g. pinning a different `node-pty` version, or
capturing a minidump).

---

## Closed

