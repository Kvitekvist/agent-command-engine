# TICKET-0100 — Token Usage shows 0 everywhere in packaged macOS app

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-25

---

## Description

In the packaged macOS build, the whole Token Usage tab renders but every value
is 0 — live quota, today's usage, by-model, by-project, and History. From
source (`npm run dev`) and from the CLI the same tokscale calls return real
data, so the data itself is fine; the failure is specific to the packaged app
on macOS.

## Reason

tokscale ships as a Node shim (`tokscale/bin.js` → `@tokscale/cli`) that, at
runtime, locates its native platform binary relative to its own module location
and `spawnSync`s it (`@tokscale/cli/dist/index.js`). Inside a packaged Electron
app that module location is *inside* `app.asar`. `existsSync` returns true for
the archived path (Electron patches `fs`), so the shim picks the packed path
and tries to exec a file that lives in the virtual archive — which the OS
cannot do. It exits 1 with no stdout (`process.exit(result.status ?? 1)`), so
every `runTokscale` call fails, `getWorkspaceReport`/`getTodayBreakdown`/etc.
swallow it, and the tab reads 0 across the board.

This is the same class as TICKET-0029, which bypassed the shim and spawned the
unpacked native binary directly — but **only for win32**. macOS (and Linux)
still went through the broken shim, so the packaged mac app regressed.

Earlier work on this report (TICKET-0098, the `extractJson` preamble handling)
was a misdiagnosis: current tokscale emits no preamble, and the parse was never
the problem. That change is kept only as harmless defensive hardening.

## Implementation Plan

* [x] Generalise `resolveWindowsBinary` → `resolveNativeBinary` covering
  darwin/linux/win32 via a pure `nativePackageFor(platform, arch)` map
* [x] Extract the `app.asar` → `app.asar.unpacked` rewrite into a pure,
  testable `redirectAsarToUnpacked(path, sep)`
* [x] Spawn the native binary directly on every platform in `runTokscale`,
  falling back to the JS shim only when no native package resolves
* [x] Unit tests for `nativePackageFor` (all shipped platforms + unshipped →
  null) and `redirectAsarToUnpacked` (POSIX + Windows separators + dev no-op)
* [x] CHANGELOG entry

---

## Files Modified

- `src/main/services/TokscaleService.js` — `nativePackageFor`,
  `redirectAsarToUnpacked`, `resolveNativeBinary`; `runTokscale` now spawns the
  native binary directly on all platforms; exports for tests
- `src/tests/tokscale-service.test.js` — tests for the two new pure helpers
- `CHANGELOG.md` — Fixed entry

---

## Testing

- `cd src && npm test` — 74 pass, 0 fail
- Verified from source that spawning the darwin native binary directly returns
  data (`getWorkspaceReport` → 6 rows, `getQuota` → 1 provider)
- **Still required:** build a packaged macOS app (`npm run package`) and confirm
  the Token Usage tab shows real numbers instead of 0. This is the only check
  that exercises the app.asar path, so the ticket stays Awaiting verification
  until then.

---

## Result

On every platform ACE spawns tokscale's native binary directly from its
unpacked location, so the packaged macOS app reports real token usage instead
of 0.

---

## Notes

The root cause was invisible to source/CLI testing because there is no
`app.asar` outside a packaged build — every earlier repro passed for that
reason. A packaging smoke test (launch the packaged app, assert a non-zero
usage read) would catch this class; noted as a possible follow-up.

---

## Closed

2026-08-25 — verified on a signed packaged macOS (arm64) build: the native
binary is unpacked and executable under `app.asar.unpacked`, spawns directly,
and the Token Usage tab shows real numbers instead of 0.
