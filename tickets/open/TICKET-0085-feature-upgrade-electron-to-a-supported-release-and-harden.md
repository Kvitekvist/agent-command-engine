# TICKET-0085 — Upgrade Electron to a supported release and harden renderer

**Status**

Open

**Type**

Maintenance

**Priority**

High

**Created**

2026-08-22

---

## Description

Upgrade Electron to a supported release and harden renderer, navigation, IPC,
filesystem, terminal-command, and external-resource security boundaries.

## Reason

Electron 31 is end-of-support. ACE exposes powerful filesystem, process, Git,
build, screenshot, and global-package operations to the renderer; compromise
impact must be reduced with defense in depth and main-authoritative validation.

## Implementation Plan

### Audit continuation, 2026-09-14

Apply real-path guards across project writes, native-selection registration, current-window IPC, CSP/navigation, validated PTY inputs and main-owned shell literals; deliberately upgrade the runtime lockfile.

2026-09-13 audit continuation (AUDIT-01 through 06 and 18): resolve real
filesystem ancestry for every project write; authorize folder registration
from native selection; bind IPC to the current window; validate terminal
options and web URLs; add regression coverage before upgrading dependencies.
Preserve the existing bundled-skills changes and interactive PTY path.

* [ ] Upgrade Electron and electron-builder with compatibility/package verification
* [ ] Add CSP, local fonts, explicit sandboxing, and navigation/window restrictions
* [ ] Validate IPC senders and typed payloads through TICKET-0075
* [ ] Resolve project paths from main-process records rather than renderer-supplied roots
* [ ] Preserve executable/argument boundaries for CLI and project commands
* [ ] Add security regression tests and a dependency-review workflow

## Files Modified

Audit continuation: ProjectPath.js, ProviderExecutable.js, agentLaunch.mjs, FileService.js, ScreenshotService.js, ProjectScaffoldService.js, LaunchPolicy.js, handlers.js, index.js, preload.js, package files and regression tests.

---

## Testing

Audit continuation: Windows junction, IPC rejection, PowerShell literal and Windows package checks pass; npm audit reported zero advisories. POSIX/macOS and native-navigation verification remain. See audit ledger for filesystem race limits.

* [ ] Security-policy and IPC authorization tests
* [ ] `npm test`
* [ ] `npm run build`
* [ ] Windows and macOS package smoke tests

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Depends on TICKET-0074 and TICKET-0075 for clean handler and contract boundaries.

## Closed

---
