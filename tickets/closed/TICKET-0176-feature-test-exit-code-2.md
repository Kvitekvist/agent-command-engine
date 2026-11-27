# TICKET-0176 — Test scripts exit 2 on failure

**Status**

Closed

**Type**

Feature

**Priority**

Medium

**Created**

2026-11-27

---

## Description

Test, smoke and install-test scripts exit 2 on failure.

## Reason

Claude Code hooks feed an error back to Claude only on exit 2, using stderr.

## Implementation Plan

* [x] Change failure exit codes to 2
* [x] Send test runner output to stderr

## Files Modified

`src/package.json`, `scripts/run_tests.sh`, `src/main/project-template/scripts/run_tests.sh`,
`src/scripts/smoke-package.js`, `src/scripts/smoke-pty.js`, `src/scripts/smoke-main.js`, `src/scripts/smoke-renderer.js`, `scripts/smoke-installed-setup.cjs`,
`scripts/test-installed-appx.ps1`, `scripts/test-hyperv-install.ps1`

## Testing

Suite: 172 pass, 1 skipped. Forced failures in both `run_tests.sh` files, `npm test`
and `smoke-package.js`. The Hyper-V and installed-AppX scripts were not run against a VM.

## Result

Done. Test runner output now goes to stderr, including on success.

## Notes

CI fails at the renderer smoke step (`Missing renderer state` on `memory B`), as it already did on `main` before this ticket.

No hook is configured by this ticket. PowerShell parameter binding errors still exit 1.

## Closed

2026-11-27
