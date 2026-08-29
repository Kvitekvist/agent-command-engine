# TICKET-0065

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-21

---

## Description

Add a GitHub Actions CI workflow that runs the test suite automatically on every
push and pull request against `main`.

---

## Reason

The suite (TICKET-0064) could only be run locally via `scripts/run_tests.sh`.
Running it in CI catches regressions before they land on `main` and gives PRs a
visible pass/fail status check.

---

## Implementation Plan

* [x] Add `.github/workflows/tests.yml` (checkout + setup-node + run the suite).
* [x] Reuse `scripts/run_tests.sh` as the single source of truth for how the
  suite is run.

---

## Files Modified

- .github/workflows/tests.yml (new)
- CHANGELOG.md
- .claude/memory/ticket_memory.md

---

## Testing

Workflow runs `bash scripts/run_tests.sh` on ubuntu-latest with Node 22. Verified
locally that the same command passes (37/37). CI status will confirm on the first
push/PR.

---

## Result

CI now runs the full node:test suite on every push and PR to `main`. No
`npm install` step is needed because the suite is dependency-free by design
(electron is stubbed; DBService is never initialized).

---

## Notes

Kept deliberately minimal: single ubuntu job. Cross-platform coverage
(windows/macos) was not added since the tested logic that is platform-specific
(FileService.RUNNABLE_EXTENSIONS) already asserts against `process.platform`, so
it validates whichever runner it lands on.

---

## Closed

2026-08-21
