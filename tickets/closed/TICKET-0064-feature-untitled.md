# TICKET-0064

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

Expand the automated test suite to cover the main-process service logic that
was previously untested (OptimizationAdvisor, LoadBalancer, FileService), and
add a single `run_tests.sh` entry point that runs the whole suite and reports a
pass/fail result.

---

## Reason

Only 3 of the main-process services (AgentService, PathService, TokscaleService)
had tests. The token-optimization advice, provider load-balancing decision, and
the FileService path-traversal guard are all pure/deterministic logic with real
correctness and security implications, but had no regression coverage. There was
also no one-command way to run the suite.

---

## Implementation Plan

* [x] Add a lightweight `electron` require-stub test helper so service modules
  that `require('electron')` can be unit-tested without a full `npm install`.
* [x] Add tests for OptimizationAdvisor.analyze (mocked DBService).
* [x] Add tests for LoadBalancer.decide (mocked DBService).
* [x] Add tests for FileService (path-traversal guard, binary/too-large refusal,
  runnable-extension gate, temp-dir round trips).
* [x] Add `scripts/run_tests.sh` that runs `node --test` over the suite.

---

## Files Modified

- src/tests/helpers/electron-stub.js (new)
- src/tests/optimization-advisor.test.js (new)
- src/tests/load-balancer.test.js (new)
- src/tests/file-service.test.js (new)
- scripts/run_tests.sh (new)
- CHANGELOG.md
- .claude/memory/ticket_memory.md

---

## Testing

`bash scripts/run_tests.sh` — runs the full node:test suite from src/.

---

## Result

Suite grew from 19 to 43 tests, all passing via `node --test`. New coverage:
OptimizationAdvisor (6 advice rules + all-clear + stats), LoadBalancer (manual
override, fallback disabled, threshold crossing, last-hour window, default
threshold, DB-failure degradation), FileService (round trip, binary/too-large
refusal, readDir ordering, path-traversal guard incl. sibling-prefix case,
runnable-extension gate). `scripts/run_tests.sh` runs the whole suite and
reports pass/fail.

---

## Notes

The suite is intentionally dependency-free: tests only cover modules whose
third-party imports are either absent at load time or stubbed (electron), so the
suite runs without `npm install`. DBService is never initialized (no sql.js /
WASM); its query methods are monkey-patched per test.

---

## Closed

2026-08-21

