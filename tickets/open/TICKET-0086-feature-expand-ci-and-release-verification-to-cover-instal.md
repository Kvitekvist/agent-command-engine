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

### Hyper-V install regression, 2026-09-25

Follow-up: every test must start from the selected clean checkpoint.

* [x] Require a named checkpoint, remove the optional-reset path, and abort before guest access if restore fails.
* [x] Record checkpoint identity/restore completion in the report, update usage, and verify repeated-run ordering with mocked Hyper-V commands.

* [x] Add a host PowerShell runner using PowerShell Direct, explicit VM/checkpoint selection, guest credential prompts, bounded waits, and retained reports.
* [x] In a clean signed-in guest, trust the supplied test certificate, install the sealed AppX, and launch the installed app through an interactive scheduled task.
* [x] Observe the actual setup UI through local Chromium debugging using the package's embedded Node runtime. Fail on restart, missing prerequisites, timeout, or setup errors; retain a screenshot and JSON evidence.
* [x] Add a runnable regression check, validate PowerShell syntax, run tests/build, and document the clean checkpoint procedure and remaining manual coverage.
* [ ] Run the signed package end to end in the selected Hyper-V VM.

Host discovery is currently blocked: Get-VM reports insufficient permissions
in the current session. No VM has been selected or modified.

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

Hyper-V continuation:

- `scripts/test-hyperv-install.ps1`
- `scripts/test-installed-appx.ps1`
- `scripts/smoke-installed-setup.cjs`
- `src/tests/installed-setup.test.js`
- `src/tests/hyperv-reset.test.js`
- `docs/hyperv-install-test.md`
- `CHANGELOG.md`

Audit continuation: tests.yml, release.yml, build scripts, prepare-release.js, bump-version.js, release-checksums.js, Vite config, App.jsx, EditorView.jsx, smoke scripts and migration/release tests.

---

## Testing

Mandatory-reset follow-up: 130 tests passed, 1 skipped; production build passed.
The new check executes the runner's actual startup statements with mocked
Hyper-V commands: both repeated runs restore before connecting, and a restore
failure prevents guest access. It also checks required checkpoint selection
and PowerShell syntax. No live snapshot restore was performed.

2026-09-25: PowerShell parser checks pass for both new scripts. The regression
check verifies stable readiness and rejects restart, setup error, timeout,
missing setup UI and intermittent readiness. Full suite: 129 passed, 1 skipped.
Production build passes. The Chromium probe was also exercised through a real
hidden Electron renderer with fixture prerequisite results, using Electron's
embedded Node runtime; readiness and screenshot capture both passed. This
validates probe transport, not a VM installation.

The actual Hyper-V run remains unverified: this session lacks permission to
enumerate VMs, and the VM/checkpoint and guest credentials have not been
provided. No VM was restored or changed. The runner requires an elevated host
PowerShell. Its elevated guest setup does not test normal-user UAC prompts,
provider login or live agent sessions. See `docs/hyperv-install-test.md`.

Audit continuation: Windows tests/build, hidden Electron and diagnostic package pass. Temporary real Git repository rejects dirty release input and package failure without tags/commits. Remote workflow and macOS execution remain.

* [ ] Exercise all workflow jobs on a branch
* [ ] Verify failure propagation for test, build, and package stages

## Result

A repeatable Hyper-V runner is implemented for sealed-package installation
and the first-run Node restart regression. It records the package hash and
guest evidence and returns failure when setup does not finish. Every run first
restores the required named baseline checkpoint, with no skip-reset option.
Reports record the checkpoint ID and whether restoration completed. The ticket
remains Open pending the VM run and the existing CI/platform checks below.

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Code signing and updates are tracked separately by TICKET-0091.

## Closed

---
