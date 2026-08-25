# TICKET-0101 — Packaging smoke test: assert tokscale runs from a packaged build

**Status**

Open

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

* [ ] Decide the cheapest reliable form. Candidate: after `electron-builder`
  produces the app, resolve the packaged main bundle's `resolveNativeBinary`
  against the built `Resources/app.asar.unpacked` tree and spawn the binary
  with a trivial arg (e.g. `usage --json` or `--version`), asserting exit 0 and
  non-empty stdout. Avoids launching a full Electron GUI.
* [ ] Alternative if a real runtime is needed: launch the packaged app headless
  and invoke the `tokens:getProjectHistory` / quota IPC path, asserting a
  non-error result.
* [ ] Assert the native binary exists under `app.asar.unpacked` for the current
  platform/arch and is executable (guards asarUnpack regressions directly).
* [ ] Wire it into `release.yml` (which already builds on macos + windows) as a
  post-`package` step, so a broken package fails the release build.
* [ ] Keep it off the fast per-PR `tests.yml` (packaging is slow); the release
  workflow is the right home.

## Files Modified

_TBD — likely a new `scripts/smoke-package.js` and a step in
`.github/workflows/release.yml`._

## Testing

_TBD — the test itself is the deliverable; verify it passes on a good build and
fails when the native binary is packed-only (e.g. temporarily remove it from
`asarUnpack`)._

## Result

_TBD_

## Notes

Ties together TICKET-0029 (win32), TICKET-0099 (three-OS unit CI), and
TICKET-0100 (macOS/Linux native spawn). Those three plus this smoke test cover
the tokscale-spawn surface across dev, unit CI, and packaged release.

## Closed

_(open)_
