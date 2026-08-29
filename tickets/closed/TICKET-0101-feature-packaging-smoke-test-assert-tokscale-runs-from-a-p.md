# TICKET-0101 — Packaging smoke test: assert tokscale runs from a packaged build

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-25

---

## Description

Add an automated smoke test that runs against a **packaged** app (not source)
and asserts that ACE can actually spawn tokscale's native binary and get a
non-empty result. The check must exercise the `app.asar` / `app.asar.unpacked`
boundary, because that is the only place the TICKET-0100 class of bug appears.

## Reason

TICKET-0100 (packaged macOS Token Usage read 0 everywhere) and TICKET-0029
(Windows console-flash / asar spawn) were both invisible to the unit suite and
to `npm run dev`: there is no `app.asar` outside a packaged build, so every
source/CLI repro passed. The three-OS unit matrix (TICKET-0099) does not close
this gap either — it runs the suite, not a package. A packaging smoke test is
the missing layer.

## Implementation Plan

* [x] Chose the cheap, GUI-free form: after `electron-builder` produces the
  app, walk `../releases` for every `app.asar.unpacked`, resolve the tokscale
  binary via `TokscaleService.nativePackageFor` (so the test looks for exactly
  the package the app resolves at runtime — drift there fails here), and spawn
  it with `--version`, asserting exit 0 and non-empty stdout. No Electron GUI.
* [x] Assert the native binary exists under `app.asar.unpacked` for the current
  platform/arch and is executable on POSIX (guards asarUnpack regressions
  directly). Only same-arch bundles are exercised so the spawn is real.
* [x] Wired into `release.yml` as a post-`package` step, so a broken package
  fails the release build before artifacts upload.
* [x] Kept off the fast per-PR `tests.yml` (packaging is slow); the release
  workflow is the right home.

## Files Modified

- `src/scripts/smoke-package.js` (new) — the smoke test. Reuses
  `TokscaleService.nativePackageFor`; `ACE_RELEASES_DIR` env override makes the
  failure path testable against a synthetic tree.
- `.github/workflows/release.yml` — added a "Smoke-test packaged build" step
  after `npm run package`, before artifact upload.
- `CHANGELOG.md` — Added entry.

## Testing

Verified against the real signed macOS build (`releases/mac` x64 +
`releases/mac-arm64`): PASS, 2 bundles, `tokscale 4.13.0` from each
`app.asar.unpacked`. Failure paths verified with `ACE_RELEASES_DIR` pointed at
synthetic trees: (A) an `app.asar.unpacked` present but the binary packed-only
→ exit 1 with an asarUnpack-drop message; (B) an empty releases dir → exit 1
"no app.asar.unpacked". Unit suite still green (74 tests).

## Result

Done. A packaged build that can't spawn tokscale from `app.asar.unpacked` now
fails the release before any artifact is uploaded. Together with TICKET-0029
(win32 fix), TICKET-0099 (three-OS unit matrix), and TICKET-0100 (macOS/Linux
fix), the tokscale-spawn surface is covered across dev, unit CI, and packaged
release.

## Notes

Ties together TICKET-0029 (win32), TICKET-0099 (three-OS unit CI), and
TICKET-0100 (macOS/Linux native spawn). Those three plus this smoke test cover
the tokscale-spawn surface across dev, unit CI, and packaged release.

## Closed

2026-08-25
