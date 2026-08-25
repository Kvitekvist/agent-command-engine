# TICKET-0099 — Run CI test suite on macOS and Windows, not just Linux

**Status**

Closed

**Type**

Enhancement

**Priority**

High

**Created**

2026-08-25

---

## Description

`tests.yml` ran the suite on `ubuntu-latest` only. The macOS/Windows matrix
existed just in `release.yml`, which fires on version tags — after code is
already merged. Platform-divergent tokscale code (spawn paths, arg parsing,
JSON-preamble handling) has repeatedly regressed on macOS while passing the
Linux-only PR check (TICKET-0059, TICKET-0061, and its re-emergence in
TICKET-0098). Because the team develops on both macOS and Windows, a fix
verified on one platform can silently break the other until a teammate hits it
at runtime.

## Reason

Move platform coverage to the point where it prevents merges: the per-PR test
job. The suite is dependency-free and runs in seconds, so a three-OS matrix is
cheap.

## Implementation Plan

* [x] Add a `fail-fast: false` matrix (`ubuntu-latest`, `macos-latest`,
  `windows-latest`) to the `test` job in `tests.yml`
* [x] Pin the run step to `shell: bash` so the one POSIX `run_tests.sh` drives
  the suite uniformly (Git Bash is present on `windows-latest`)
* [x] Document the why in the workflow header

---

## Files Modified

- `.github/workflows/tests.yml` — matrix over three OSes, `fail-fast: false`,
  `shell: bash` on the run step

---

## Testing

Local: `bash scripts/run_tests.sh` — 72 pass, 0 fail. Full verification is the
CI run itself: on the next PR/push to `main`, confirm three green checks
(ubuntu, macos, windows) instead of one.

---

## Result

Every PR and push to `main` now runs the suite on macOS, Windows, and Linux,
so a platform-specific regression fails the check before merge rather than
surfacing on a teammate's machine.

---

## Notes

Scope was deliberately limited to CI coverage. Complementary ideas raised but
not taken here: extracting the tokscale report arg-builder into a tested
helper so the `--workspace=` form is pinned, and an AGENTS.md rule requiring a
regression test for platform-specific fixes and surgical (per-fix) reverts.

---

## Closed

2026-08-25 — three-OS matrix (ubuntu/macos/windows) runs green on PR #1.
