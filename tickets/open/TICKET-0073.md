# TICKET-0073

**Status**

Open

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
* [x] Synchronize version and current-state documents
* [x] Mark duplicate/stale guidance as legacy while preserving useful history

## Files Modified

- .claude/project_config.md
- .claude/memory/tech_stack.md
- .claude/memory/project_status.md
- .claude/tickets/README.md

## Testing

* [x] Run Markdown-link and metadata-consistency checks

## Result

Implemented. `src/package.json` and `version.txt` are explicitly canonical
for the version; the current-state guide is canonical for active priorities;
and `tickets/` is the only active ticket system.

## Notes

---

## Closed

---
