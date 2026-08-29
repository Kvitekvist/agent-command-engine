# TICKET-0081 — Remove unsupported npm configuration and make temporary-directory tests

**Status**

Open

**Type**

Maintenance

**Priority**

Low

**Created**

2026-08-22

---

## Description

Remove unsupported npm configuration and make temporary-directory tests configurable for restricted environments.

## Reason

`npm test` emits unsupported `.npmrc` warnings, while filesystem tests cannot run in sandboxed CI without an allowed temporary root.

## Implementation Plan

* [x] Replace or remove unsupported npm settings
* [x] Add an opt-in test temporary-root setting
* [x] Document the restricted-environment test command

## Files Modified

- src/.npmrc (deleted)
- src/package.json
- src/tests/helpers/temp-dir.js
- src/tests/file-service.test.js
- src/tests/pty-perms.test.js

## Testing

* [x] `npm test` (58 passing, 1 platform-inapplicable POSIX-permission test skipped on Windows)
* [x] `npm run build`

## Result

Implemented. Unsupported npm configuration is removed. Filesystem tests use
the `ACE_TEST_TMPDIR` environment variable when a restricted runner provides
an approved writable parent; otherwise they use the normal OS temporary
directory.

## Notes

The POSIX executable-bit assertion is intentionally skipped on Windows, where
the filesystem does not expose that permission model.

Restricted-environment command (PowerShell):
`$env:ACE_TEST_TMPDIR = '<writable directory>'; cmd /c npm test`.

## Closed

---
