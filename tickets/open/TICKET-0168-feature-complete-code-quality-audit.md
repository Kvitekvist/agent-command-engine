# TICKET-0168: Complete modularity and unused-code review

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-29

---

## Description

Complete the requested source review beyond the project creation, memory and settings paths already examined. Identify concrete bugs, meaningful duplication and confirmed unused code.

## Reason

The initial review was focused and did not establish repository-wide correctness or dead-code coverage. The user requested a broader review of modularity, reuse, variables and bugs.

## Implementation Plan

* [ ] Use the node map and existing tickets to bound the remaining review across main, preload, renderer and PTY lifecycle paths.

* [ ] Trace callers and data flow before proposing changes. Distinguish confirmed bugs from unverified risks.

* [ ] Record findings with file locations, triggering conditions and appropriate validation. Reuse matching tickets or create focused bug tickets.

* [ ] Remove confirmed dead code, including the unused local path import in projects:consumeSetupFlag if still present; consolidate duplication only where behavior and ownership justify reuse.

* [ ] Avoid reopening closed decomposition tickets solely to split files. Preserve unrelated working-tree changes.

* [ ] Record reviewed areas, remaining gaps and final validation in this ticket.

## Files Modified

None. Planning only.

## Testing

Pending: checks appropriate to each accepted change, followed by npm test and npm run build from src/. A review-only result must explicitly state that no implementation checks were needed.

## Result

Not implemented.

## Notes

TICKET-0164 through TICKET-0167 and TICKET-0120 already cover the initial findings. Do not duplicate those issues. No new dependencies or speculative abstractions are requested.

## Closed

Pending.

