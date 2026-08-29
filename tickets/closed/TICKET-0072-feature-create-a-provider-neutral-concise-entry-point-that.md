# TICKET-0072 — Create a provider-neutral, concise entry point that reliably routes

**Status**

Closed

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

Completed under TICKET-0093:
- AGENTS.md (rewritten as the single entry point)
- docs/agents/START.md (merged into AGENTS.md and removed)

## Testing

* [x] Verify all local Markdown links resolve

## Result

Implemented, but only partly by this ticket. The layered documents landed
here; the entry point was not yet genuinely provider-neutral, because the
commit format, definition of done, branch strategy, and ticket workflow still
lived only in `.claude/CLAUDE.md`, which non-Claude agents never read.
TICKET-0093 moved those rules into `AGENTS.md`, merged `START.md` into it to
remove the second hop, and added the node-map retrieval protocol. Closing
here as superseded by that work.

## Notes

---

## Closed

2026-08-22
