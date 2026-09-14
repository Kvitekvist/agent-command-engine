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

Current CI runs dependency-free service tests on Windows, macOS and Linux. It cannot detect
renderer/build/package failures or Windows/macOS native integration regressions.

## Implementation Plan

### Audit continuation, 2026-09-14

Keep three-platform tests; add locked install, actual SQL migration, build and native renderer/PTy smoke. Split Monaco and make release helpers clean-tree/reviewed-SHA only.

2026-09-13: AUDIT-15/16/29. Install locked dependencies and build on PRs;
run tests before release packaging; add native PTY and real SQL migration
checks. Build helpers keep version files untouched. Release preparation
requires a reviewed SHA and clean tree, and never commits, merges or pushes.

* [ ] Add `npm ci`, syntax checks, tests, and renderer/main builds to CI
* [ ] Add renderer, IPC contract, migration, and Electron smoke tests
* [ ] Add Windows/macOS native PTY and packaging jobs with appropriate caching
* [ ] Code-split the renderer so routine startup does not load the full Monaco bundle
* [ ] Keep package-lock and release metadata synchronized
* [ ] Make version bumping an explicit release action rather than a normal build side effect
* [ ] Require a clean reviewed diff instead of staging every file automatically

## Files Modified

Audit continuation: tests.yml, release.yml, build scripts, prepare-release.js, bump-version.js, release-checksums.js, Vite config, App.jsx, EditorView.jsx, smoke scripts and migration/release tests.

---

## Testing

Audit continuation: Windows tests/build, hidden Electron and diagnostic package pass. Temporary real Git repository rejects dirty release input and package failure without tags/commits. Remote workflow and macOS execution remain.

* [ ] Exercise all workflow jobs on a branch
* [ ] Verify failure propagation for test, build, and package stages

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Code signing and updates are tracked separately by TICKET-0091.

## Closed

---
