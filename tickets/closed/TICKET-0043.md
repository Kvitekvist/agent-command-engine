# TICKET-0043

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-11

---

## Description

Reported by the user: "I am not able to fill in project name when I try to
make a new project using ACE." In the packaged app, clicking **+** in the
Sidebar shows the new-project name field, but typing into it produces
nothing — the field silently ignores the keyboard. The rest of the app is
usable and typing works elsewhere (e.g. into a running agent's terminal).

Confirmed root cause: **ACE has no single-instance lock.** When more than
one ACE window/instance is open at once (easy to do — nothing prevents a
second launch), Windows routes keyboard input to whichever window currently
holds OS-level focus, which is not necessarily the window the user is
looking at and clicking in. So keystrokes aimed at the front window's
transient project-name field are delivered to a different ACE window
instead. Closing every ACE window and reopening a single one makes typing
work again — the user verified exactly this.

## Reason

Diagnosis (see Notes for the full method):

- The name field (`Sidebar.jsx:91`) is a correctly-wired React controlled
  input. No CSS/overlay/drag-region blocks it, no global key handler
  intercepts it, and the installed build contains this exact current code
  (not a stale binary).
- Driving the *real packaged v0.1.2 build* over the Chrome DevTools Protocol
  proved the input works under every reproducible condition — `autoFocus`
  lands on it, it holds focus, nothing overlays it, and synthetic
  keys/text update the React value — **including with a running agent's
  xterm terminal mounted** (the "terminal steals focus" theory was tested
  and disproven: focus stayed on the input for 3+ seconds and typing still
  worked). CDP input bypasses the OS layer, so it can't reproduce an
  OS-focus problem — which is what this turned out to be.
- The user confirmed: typing works elsewhere in ACE, and closing all ACE
  windows and reopening exactly one fixes it → classic multiple-instance /
  OS-keyboard-focus split. `index.js` has no `app.requestSingleInstanceLock()`
  (already flagged as a gap in `.claude/memory/architecture.md` Gotchas).

Secondary benefit: a single-instance lock also removes the documented risk
of two instances writing the same on-disk `cpi.db` (DBService rewrites the
whole file on every write via `db.export()`), which could corrupt it.

## Implementation Plan

* [x] Acquire `app.requestSingleInstanceLock()` early in `src/main/index.js`;
      if not acquired, `app.quit()` and skip window creation.
* [x] Add a `second-instance` handler that restores/shows/focuses the
      existing `mainWindow` so a re-launch surfaces the running app.
* [x] Guard the `whenReady` window-creation path so a losing second instance
      never briefly creates a window or touches `cpi.db`.
* [x] Update docs (README, architecture, project memory, changelog, ticket
      memory).
* [x] Build main, run tests, live-verify a second launch focuses the
      existing window.

## Files Modified

- `src/main/index.js` — single-instance lock + `second-instance` focus handler
- `README.md`
- `.claude/memory/architecture.md` (Gotchas: gap resolved)
- `.claude/memory/project_memory.md`
- `.claude/memory/ticket_memory.md`
- `CHANGELOG.md`

## Testing

- `npm run build:main` clean.
- `npm test` (existing suite) green.
- Live: launched the packaged build, then launched it a second time —
  confirmed the second launch does not open a new window and instead
  focuses the already-running one (see Result).

## Result

Made ACE single-instance in `src/main/index.js`:
`app.requestSingleInstanceLock()` is acquired at startup; if not acquired the
process calls `app.quit()` and the `whenReady` body early-returns (so a
losing second instance never creates a window or opens `cpi.db`), and a
`second-instance` handler restores/shows/focuses the existing `mainWindow`.

Verified:
- `npm run build:main` clean; `npm test` 12/12 pass.
- Live: launched two instances sharing one throwaway `--user-data-dir` (they
  must share a profile to contend, since the lock is keyed to the userData
  path — a separate `--user-data-dir` gets its own lock namespace, which is
  why the isolation testing trick documented in architecture.md still works).
  The first instance initialized normally and stayed alive; the second exited
  immediately with code 0 and produced no startup output at all (it hit
  `app.quit()` before the `whenReady` body ran) — confirming no competing
  window and no second DB open.

Remaining: a final confirmation from the user, in their own normal
multi-window workflow, that they no longer end up unable to type — expected
once they run a build containing this fix.

## Notes

Diagnostic technique worth reusing for any future "packaged app behaves
differently from dev" report: launch the packaged build with
`--remote-debugging-port=<port> --user-data-dir=<throwaway>` (isolated
profile, real app/DB untouched), attach a raw CDP client (native
`WebSocket`/`fetch`, no deps — same approach TICKET-0038 established), and
inspect `document.activeElement`, `elementFromPoint`, and inject
`Input.*` events to prove whether the renderer itself is at fault. Here it
proved the renderer was fine, which is what redirected the investigation to
the OS/window-focus layer. Kill only that instance afterward by finding the
PID that owns the unique debug port — never a blanket taskkill, which would
also kill the user's real running app.

The user's environment had multiple ACE windows open; the fix prevents that
from happening going forward rather than relying on the user to keep only
one open.

## Closed

2026-08-11
