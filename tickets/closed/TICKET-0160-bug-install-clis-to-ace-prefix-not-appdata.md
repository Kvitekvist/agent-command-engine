# TICKET-0160 — Install the CLIs into %USERPROFILE%\.ace\npm instead of disabling MSIX virtualization

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-27

---

## Description

TICKET-0157 fixed hidden npm installs in the AppX build by declaring the
restricted `unvirtualizedResources` capability. Partner Center flags it for
manual approval. Only AppData (and HKCU\Software) writes are redirected, so
install the CLIs somewhere that isn't and drop the capability.

---

## Reason

Avoid a restricted-capability review that can delay or block Store
certification, and restore the Windows 10 1809 floor.

---

## Implementation Plan

* [x] `ShellPath.aceNpmPrefix()` = `%USERPROFILE%\.ace\npm` on Windows.
* [x] `ensureAceNpmOnPath()` at startup appends it to the process PATH, so
  prereq checks, `providerExecutable` and agent terminals find it.
* [x] `prereqs:install` sets `npm_config_prefix` to it; on success it also adds
  the folder to the user's saved PATH (`addToUserPath`, keeps REG_EXPAND_SZ).
* [x] `prereqs:uninstall` removes ACE's copy when present, else the global one.
* [x] Revert the TICKET-0157 manifest patch and MinVersion 10.0.19041.0.

---

## Files Modified

- `src/main/services/ShellPath.js`
- `src/main/index.js`
- `src/main/ipc/handlers.js`
- `scripts/build-msix.js`
- `src/tests/shell-path.test.js`

---

## Testing

- Inside the 0.1.35 package container (`Invoke-CommandInDesktopPackage`):
  writes to `%USERPROFILE%` and `HKCU\Environment` reach the real system;
  `%APPDATA%` writes are redirected.
- `addToUserPath` against the real registry: appends once, keeps
  ExpandString; original value restored afterwards.
- `npm_config_prefix` with a space in the path gives `<prefix>\node_modules`
  plus shims in `<prefix>`, the layout `providerExecutable` searches.
- `cd src && npm test`: 136 pass.
- v0.1.40 AppX verified on a clean VM by the user.

---

## Result

Shipped in v0.1.40. The Store package no longer declares a restricted capability.

---

## Notes

macOS/Linux are unchanged (`aceNpmPrefix` returns null there).

---

## Closed

2026-09-28
