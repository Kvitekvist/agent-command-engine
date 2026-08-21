# TICKET-0066

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-21

---

## Description

Creating a new agent terminal on macOS (and Linux) fails with
`Failed to start terminal: posix_spawnp failed.`. The same flow works on
Windows.

---

## Reason

node-pty ships a small native helper binary, `spawn-helper`, on POSIX
platforms (macOS/Linux). node-pty execs the user's shell *through* this
helper, so the helper must have the executable bit set. In this repo's
`node_modules/node-pty/prebuilds/darwin-*/spawn-helper` the file was
`-rw-r--r--` (no `+x`), so `posix_spawnp` on the helper failed and node-pty
surfaced `posix_spawnp failed`.

The executable bit gets stripped by some package-manager / archive
extraction paths, so this must be restored deterministically rather than
by a one-off `chmod`. Windows is unaffected because it uses ConPTY and has
no `spawn-helper`.

---

## Implementation Plan

* [x] Restore the executable bit on the checked-out `spawn-helper` binaries.

* [x] Add `scripts/fix-pty-perms.js` that chmods every
  `prebuilds/**/spawn-helper` (and any `build/Release/spawn-helper`) under
  node-pty, no-op on Windows.

* [x] Wire it as a `postinstall` script so a fresh `npm install` always
  leaves the helper executable.

* [x] Surface a clearer hint in ptyHost when a spawn fails on POSIX.

---

## Files Modified

- src/scripts/fix-pty-perms.js (new)
- src/package.json (postinstall)
- src/main/ptyHost.js (clearer POSIX spawn error)

---

## Testing

- `node src/scripts/fix-pty-perms.js` then verify
  `ls -la node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` shows
  `-rwxr-xr-x`.
- Launch a new agent terminal on macOS; a shell starts instead of the
  posix_spawnp error.

---

## Result

Fixed. Restored `+x` on the darwin-arm64/darwin-x64 `spawn-helper` binaries;
new agent terminals start a shell instead of erroring. Made durable via a
`postinstall` script so fresh installs stay fixed. All 37 tests pass.

---

## Notes

Windows was unaffected because it uses ConPTY (no spawn-helper). node-pty is
already `asarUnpack`'d, so a packaged mac app keeps the on-disk (now
executable) helper.

---

## Closed

2026-08-21
