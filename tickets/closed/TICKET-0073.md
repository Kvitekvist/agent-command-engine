# TICKET-0073 — Consolidate canonical project metadata and remove stale or duplicate

**Status**

Closed

**Type**

Documentation

**Priority**

High

**Created**

2026-08-22

---

## Description

Consolidate canonical project metadata and remove stale or duplicate agent documentation sources.

## Reason

Version and ticket-state documents disagree, `project_config.md` is unfilled, and both `.claude/tickets/` and `tickets/` contain ticket material.

## Implementation Plan

* [x] Define canonical locations and ownership for status, tickets, and release metadata
* [x] Synchronize version and current-state documents (completed under TICKET-0093 — see Result)
* [x] Mark duplicate/stale guidance as legacy while preserving useful history

## Files Modified

- .claude/project_config.md
- .claude/memory/tech_stack.md
- .claude/memory/project_status.md
- .claude/tickets/README.md

Completed under TICKET-0093:
- .claude/memory/MEMORY.md
- .claude/memory/tech_stack.md
- .claude/memory/project_status.md
- docs/agents/current-state.md
- README.md

## Testing

* [x] Run Markdown-link and metadata-consistency checks

## Result

Ownership was defined here, but the synchronization step was not actually
performed: at the time this ticket was written `src/package.json` said
0.1.18 while `docs/agents/current-state.md` said 0.1.17, `README.md` and
`project_status.md` said 0.1.1, and `tech_stack.md` contradicted itself
within six lines (canonical 0.1.17 on line 5, `Version: 0.1.1` on line 11).
`MEMORY.md` also still advertised `project_status.md` as current while that
file called itself a historical snapshot.

TICKET-0093 completed it: the version is now stated only in
`src/package.json` and `version.txt`, every other file points at them rather
than restating a number, and `MEMORY.md` is relabelled as a historical index
with `project_status.md` explicitly marked superseded. `tickets/` remains the
only active ticket system. Closing as genuinely complete.

## Notes

---

## Closed

2026-08-22
