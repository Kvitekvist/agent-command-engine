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

* [ ] Upgrade Electron and electron-builder with compatibility/package verification
* [ ] Add CSP, local fonts, explicit sandboxing, and navigation/window restrictions
* [ ] Validate IPC senders and typed payloads through TICKET-0075
* [ ] Resolve project paths from main-process records rather than renderer-supplied roots
* [ ] Preserve executable/argument boundaries for CLI and project commands
* [ ] Add security regression tests and a dependency-review workflow

## Files Modified

---

## Testing

* [ ] Security-policy and IPC authorization tests
* [ ] `npm test`
* [ ] `npm run build`
* [ ] Windows and macOS package smoke tests

## Result

---

## Notes

Depends on TICKET-0074 and TICKET-0075 for clean handler and contract boundaries.

## Closed

---
