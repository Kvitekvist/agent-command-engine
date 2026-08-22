# TICKET-0072

**Status**

Open

**Type**

Refactor

**Priority**

High

**Created**

2026-08-22

---

## Description

Create a provider-neutral, concise entry point that reliably routes every coding agent to the right current project information.

## Reason

The repository has no root `AGENTS.md`; `.claude/CLAUDE.md` is not automatically discovered by every agent, and its session checklist conflicts with the memory index.

## Implementation Plan

* [x] Add root `AGENTS.md` with task-based routing and non-negotiable safeguards
* [x] Add layered agent reference documents for startup, current state, and architecture navigation
* [x] Make Claude-specific instructions defer to the shared entry point

## Files Modified

- AGENTS.md
- docs/agents/START.md
- docs/agents/current-state.md
- docs/agents/architecture-guide.md
- docs/agents/conventions.md
- .claude/CLAUDE.md

## Testing

* [x] Verify all local Markdown links resolve

## Result

Implemented. All agents now have a root-discoverable entry point and
task-specific context routing. The legacy detailed memory files remain
available for targeted historical searches.

## Notes

---

## Closed

---
