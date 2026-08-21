# TICKET-0061: Harden tokscale Usage/History Against Silent Failures

**Type**: Bug
**Status**: Completed
**Created**: 2026-08-21
**Updated**: 2026-08-21

## Problem

Reported live alongside TICKET-0060: the Token Usage dashboard "shows no data".
Investigation found the primary cause was a stale pre-TICKET-0059 build (see Note),
but it also surfaced two real robustness gaps in `TokscaleService`, plus a
correctly-diagnosed-but-out-of-our-control quota gap.

## Root Cause

1. **Fragile JSON parse.** `runTokscale` did a bare `JSON.parse(stdout)`.
   tokscale's `report` subcommand prints a plain-text status line
   (`"<N> new sessions added to wiki"`) the first time it catalogs
   previously-unseen sessions, which can land on stdout prepended to the JSON —
   making that otherwise-successful call throw, which `getWorkspaceReport`
   swallows into an empty History (recovering only on a later refresh). Not caught
   by tests, which mock tokscale.

2. **Silent error swallow.** `getWorkspaceReport` caught every per-client error
   and returned `[]` with only a comment — a broken tokscale call was
   indistinguishable from a genuinely empty project, with nothing in the logs.

3. **Empty quota bars (out of scope to fix).** `tokscale usage --json` returns
   `[]` on macOS because tokscale can't read Claude's OAuth credentials
   (Claude Code stores them in the macOS Keychain; tokscale looks for a
   credentials file), printing "No Claude OAuth credentials. Run 'claude' to log
   in. — skipped". This is a tokscale/environment limitation, not an ACE bug — the
   today/model/project breakdowns (which read session transcripts, not OAuth) work
   fine. `UsageCard` already renders this as a benign "No quota data." No code
   change; documented here.

## Solution

- **`extractJson(stdout)`** (new, exported) — slices from the first `{`/`[` to the
  last `}`/`]` before parsing, tolerating both a preamble (the wiki status line)
  and any trailing noise. Still throws on genuinely unparseable output so real
  failures aren't hidden. `runTokscale` now uses it.
- **`getWorkspaceReport`** — `console.warn` the swallowed per-client error (still
  returns `[]` so one logged-out provider doesn't blank the other's history).

## Files Changed

- `src/main/services/TokscaleService.js` — `extractJson` helper (used by
  `runTokscale`, exported), `console.warn` in `getWorkspaceReport`
- `src/tests/tokscale-service.test.js` — `extractJson` cases (preamble, trailing,
  clean, unparseable)

## Testing

- [x] `npm test` — 19/19 pass (2 new `extractJson` cases)
- [x] `extractJson` verified against real `tokscale --today` output (parses,
      4 entries)
- [x] `npm run build` clean

## Note

The reported "dashboard shows no data" was primarily the same stale build behind
TICKET-0059/0058 — the user's installed app predated the History fix. Installing
the current 0.1.9 DMG (or a repackage of current main) resolves the History
symptom; this ticket hardens the code path so a future preamble/error can't
silently blank it again.
