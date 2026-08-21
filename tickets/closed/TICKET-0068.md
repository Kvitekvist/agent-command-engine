# TICKET-0068

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-21

---

## Description

Add automated test coverage for the PTY / agent-terminal spawn fix shipped in
TICKET-0066. That fix had no regression test, so nothing guards against the
`spawn-helper` executable bit being lost again or the POSIX `posix_spawnp`
error hint regressing.

---

## Reason

TICKET-0066 fixed new agent terminals failing on macOS/Linux with
`posix_spawnp failed` (node-pty's native `spawn-helper` had lost its `+x`
bit). The two pieces of that fix -- `fix-pty-perms.js` restoring the
executable bit and `ptyHost` appending a fix hint on a POSIX spawn failure --
were untested. This ticket makes both testable and covers them, keeping the
suite dependency-free (no node-pty / Electron needed).

---

## Implementation Plan

* [x] Export `findSpawnHelpers` / `chmodExec` from `fix-pty-perms.js` and only
  run `main()` when the script is invoked directly.

* [x] Extract the POSIX `posix_spawnp` hint into a testable
  `describeSpawnError(message, platform)` in `ptyHost.js` and export it.

* [x] Add `tests/pty-perms.test.js` covering helper discovery, executable-bit
  restoration on a temp fake node-pty tree, and the POSIX error hint.

---

## Files Modified

- src/scripts/fix-pty-perms.js
- src/main/ptyHost.js
- src/tests/pty-perms.test.js (new)

---

## Testing

- `bash scripts/run_tests.sh` -- full suite green including the new cases.

---

## Result

Done. `fix-pty-perms.js` and `ptyHost.js` refactored to export their now-tested
helpers (no behavior change to the fix). New `tests/pty-perms.test.js` adds 7
dependency-free cases covering spawn-helper discovery, the executable-bit
restoration that `posix_spawnp failed` on, and the POSIX-only error hint. Full
suite green at 44/44 via `bash scripts/run_tests.sh`.

---

## Closed

2026-08-21

---

## Notes
