# TICKET-0086 — Expand CI and release verification to cover installed dependencies

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

Expand CI and release verification to cover installed dependencies, renderer
builds, IPC integration, database migrations, Electron startup, native PTYs,
and platform packaging.

## Reason

Current CI runs dependency-free service tests on Ubuntu only. It cannot detect
renderer/build/package failures or Windows/macOS native integration regressions.

## Implementation Plan

* [ ] Add `npm ci`, syntax checks, tests, and renderer/main builds to CI
* [ ] Add renderer, IPC contract, migration, and Electron smoke tests
* [ ] Add Windows/macOS native PTY and packaging jobs with appropriate caching
* [ ] Code-split the renderer so routine startup does not load the full Monaco bundle
* [ ] Keep package-lock and release metadata synchronized
* [ ] Make version bumping an explicit release action rather than a normal build side effect
* [ ] Require a clean reviewed diff instead of staging every file automatically

## Files Modified

---

## Testing

* [ ] Exercise all workflow jobs on a branch
* [ ] Verify failure propagation for test, build, and package stages

## Result

---

## Notes

Code signing and updates are tracked separately by TICKET-0091.

## Closed

---
