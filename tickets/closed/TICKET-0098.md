# TICKET-0098 — Defensive tokscale JSON-preamble hardening (misdiagnosis of the macOS blank-tab report)

> **Superseded by [TICKET-0100].** This ticket originally attributed the macOS
> "token info not displayed" report to a lost `extractJson` preamble fix
> (TICKET-0061). That was wrong: current tokscale emits no preamble, and the
> real cause was a packaging bug (native binary spawned from inside `app.asar`)
> fixed in TICKET-0100. The `extractJson` change here is kept only as harmless
> defensive parsing; it does not fix the reported symptom.

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

On macOS, the Token Usage tab shows no token info / an empty "History (this
project)" section on the first refresh after new sessions appear. This is the
same failure TICKET-0061 fixed: tokscale's `report` subcommand prepends a
plain-text status line (`"<N> new sessions added to wiki"`) to its stdout the
first time it catalogs previously-unseen sessions, and a bare
`JSON.parse(stdout)` in `runTokscale` throws on that otherwise-successful run.
`getWorkspaceReport` swallows the error into an empty array, blanking History.

## Reason

TICKET-0061 added `extractJson()` to tolerate the preamble. Commit `b1ad161`
blanket-reverted TICKET-0061 the same night. Later, TICKET-0067 re-applied
only the *sibling* fix from that ticket family (the `--workspace=<key>`
arg-parsing fix, originally TICKET-0059) — the `extractJson` hardening was
never re-applied, so `runTokscale` went back to a bare `JSON.parse(stdout)`
and the macOS regression returned.

## Implementation Plan

* [x] Re-add `extractJson()` to `TokscaleService.js` and route `runTokscale`'s
  parse through it
* [x] Restore the per-client `console.warn` in `getWorkspaceReport` so a
  broken tokscale call is distinguishable from a genuinely empty project
* [x] Export `extractJson` and re-add its unit tests
* [x] CHANGELOG `Fixed` entry

---

## Files Modified

- `src/main/services/TokscaleService.js` — re-added `extractJson()`, routed the
  parse through it, restored per-client warn logging, exported the helper
- `src/tests/tokscale-service.test.js` — re-added preamble-tolerance and
  unparseable-output tests
- `CHANGELOG.md` — Fixed entry

---

## Testing

`cd src && npm test` — 72 pass, 0 fail, including the two re-added
`extractJson` tests.

---

## Result

`runTokscale` now slices from the first JSON opener before parsing, so
tokscale's status preamble no longer blanks the Token Usage tab on macOS.

---

## Notes

Root cause was a revert whose sibling fix was re-applied while this one was
not — worth guarding against by keeping the two hardening pieces together.

---

## Closed

2026-08-25 — kept as defensive hardening; real fix tracked in [TICKET-0100].
