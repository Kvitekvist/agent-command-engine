# TICKET-0054: Auto-bump version number on build.bat

**Status:** Closed
**Priority:** Low
**Created:** 2026-08-17
**Closed:** 2026-08-17

---

## Issue

User requested that running `scripts/build.bat` automatically creates a new
version number, instead of the version only ever being bumped manually
(previously done by hand per release ticket, e.g. TICKET-0045, TICKET-0047).

---

## Requirements

* [x] `scripts/build.bat` bumps the version before compiling
* [x] Version bump keeps `src/package.json` and root `version.txt` in sync
      (both are treated as the version source of record elsewhere, e.g.
      TICKET-0047's crash-fix release re-synced a stale `version.txt`)
* [x] Bump is a simple patch increment (`major.minor.PATCH`) — routine dev
      builds don't warrant a minor/major bump decision
* [x] `scripts/build.sh` (macOS/Linux) gets the same behavior for parity
      with the existing `.bat`/`.sh` script pairs
* [x] Old -> new version is printed so the bump is visible, not silent
* [x] `npm run build` (called directly, bypassing build.bat) is NOT
      affected — the bump lives in the wrapper script, not package.json
      scripts, so CI/other automated invocations aren't surprised by it

---

## Implementation Plan

1. Add `scripts/bump-version.js`: reads `src/package.json`'s version,
   increments the patch segment, writes it back (preserving file
   formatting), and mirrors the new version into root `version.txt`.
2. Call it from `build.bat` (and `build.sh`) before `npm run build`, so a
   failed bump aborts the build rather than compiling silently un-bumped.

---

## Files Modified

- `scripts/bump-version.js` (new)
- `scripts/build.bat`
- `scripts/build.sh`

---

## Testing

* [x] Run `build.bat` twice, confirm version increments both times and
      `src/package.json` + `version.txt` stay in sync
* [x] Confirm a failed bump (e.g. malformed version) aborts before `npm
      run build` runs (verified by reading the errorlevel-guard logic;
      not forced with a malformed version since that would leave the repo
      in a broken state to reset afterward)

---

## Result

**Live-verified.** Ran `scripts\build.bat` twice end-to-end via `cmd.exe`
(exit code 0 both times):
- Run 1: `0.1.5 -> 0.1.6` (also exercised once more directly via `node
  scripts/bump-version.js` while developing, landing at `0.1.7` before the
  second full `build.bat` run)
- Run 2: `0.1.7 -> 0.1.8`, full build completed (`build:renderer` +
  `build:main`), `src/package.json` and `version.txt` both read `0.1.8`
  afterward.

CRLF line endings preserved in both files (verified via `xxd`, matching
the pre-existing file style). `npm test` still 13/13 after the version
changes. `npm run build` invoked directly (not through `build.bat`) does
not touch the version — the bump lives only in the wrapper scripts.

---

## Notes

- Bump is a plain patch increment; no attempt to distinguish "real" builds
  from throwaway ones. If routine `build.bat` runs turn out to bump the
  version too eagerly in practice, revisit — options would be gating the
  bump behind a flag or only bumping on `npm run package`/`release.bat`
  instead. Left as a plain patch bump per the user's literal request.
- `release.bat` was deliberately left untouched: it already reads whatever
  version is current in `src/package.json` at release time, so it picks up
  whatever `build.bat` last bumped it to automatically, with no changes
  needed there.
