# TICKET-0154 — Two pre-existing CI failures since v0.1.34, both fixed

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-18

---

## Description

User asked to compile release artifacts and confirm GitHub CI is green.
`tests.yml` had actually been red since the v0.1.34 push (2026-09-14) on
every platform — nobody had iterated on it before this. Two independent,
unrelated failures:

1. `audit-regressions.test.js`'s "build detection..." test compared
   `detectBuild`'s realpath'd return value against a non-realpath'd
   `mkdtemp` path — failed on macOS (`/var` → `/private/var` symlink) and
   Windows (`RUNNER~1` 8.3 short name vs the long form).
2. `scripts/smoke-renderer.js`'s `click(label)` helper matched a button's
   `textContent` by strict equality, but Sidebar nav and project-list
   buttons render an icon glyph glued directly onto the label with no
   separating space (e.g. `"📊Usage (whole machine)"`) — every nav click in
   the whole smoke script had been silently no-op'ing since v0.1.34 added
   it, and the script only noticed once forward progress genuinely depended
   on one (`smoke.pendingHistory(1)` after navigating to Usage).

---

## Reason

Confirmed via `gh run view` on the actual failed CI runs (both the 0.1.34
push and this session's own push reproduced identically), then reproduced
both locally: #1 via `node --test`, #2 by running
`node node_modules/electron/cli.js scripts/smoke-renderer.js` directly and,
for the initial root-cause check, a throwaway debug script that dumped
button `textContent` to confirm the icon-glyph theory before touching
anything.

---

## Implementation Plan

* [x] `audit-regressions.test.js`: realpath the temp root before comparing,
  matching the convention the same file's other test already uses right
  below it.
* [x] `smoke-renderer.js`: `click()` matches by substring
  (`textContent.includes(label)`) instead of strict equality, same
  tolerant style the file's own `until()` checks already use.
* [x] Verify all three smoke scripts pass locally (renderer, main, pty) and
  the full `node --test` suite is green.
* [x] No `CHANGELOG.md` entry — test/CI-only, no user-facing behavior
  changed.

---

## Files Modified

- `src/tests/audit-regressions.test.js`
- `src/scripts/smoke-renderer.js`

---

## Testing

- `node --test tests/*.test.js` (from `src/`): 126 passed, 1 skipped
  (POSIX-only), 0 failed.
- `node node_modules/electron/cli.js scripts/smoke-renderer.js`: passed
  (previously failed at "Missing renderer state: smoke.pendingHistory(1)").
- `node scripts/smoke-pty.js`: passed.
- `node node_modules/electron/cli.js scripts/smoke-main.js`: passed.
- `npm run build`: renderer + main passed.
- Pushed to `main`; `tests.yml` re-run pending confirmation across all
  three OSes.

---

## Result

Both pre-existing CI failures fixed at their root: a test comparing an
unresolved temp path against a security-realpath'd one, and a smoke-test
helper whose exact-match assumption never held for any icon-prefixed
button. No production code changed for either fix — both were bugs in the
tests themselves.

---

## Notes

These had been broken since the v0.1.34 release commit (2026-09-14) with no
CI gate having caught it before merge. Worth considering a branch
protection rule requiring `tests.yml` to pass before merging to `main`, so
this class of "release ships on top of a red pipeline" doesn't recur —
raised for the user's decision, not applied here.

---

## Closed

---
