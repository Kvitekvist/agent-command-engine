# Project Memory

This file represents the long-term memory of the project.

Update continuously.

---

## Project Vision

Describe the long-term goal.

---

## Current Milestone

Current development milestone.

---

## Active Priorities

*

*

*

---

## Technical Debt

List known technical debt.

---

## Known Issues

List unresolved problems.

---

## Future Ideas

Ideas worth considering later.

---

## Development Patterns

### User Work Style

**Autonomous Implementation Preference**: User prefers minimal clarifying questions for infrastructure/system tasks. When given clear directive ("make a ticket subfolder structure system"), proceed with full implementation using best practices without seeking approval for architectural decisions. Applies to: infrastructure improvements, tooling, system organization, documentation structure.

### Phased Implementation

For large feature sets (10+ items), use phased implementation:

**Phase 1: Foundation** (Implement immediately)
- Highest priority items
- Items other phases depend on
- Core infrastructure
- Quality gates

**Phases 2-5: Roadmap** (Document, implement iteratively)
- Build on Phase 1 foundations
- Each phase has clear theme/purpose
- Dependencies flow downward (Phase N needs Phase N-1)

**Rationale**: 
- Prevents overwhelming scope
- Allows testing foundations before scaling
- Enables learning from early phases
- Follows expert pattern: Context → Connections → Capabilities → Cadence

**Example**: 28 skills → Phase 1 (6 foundation skills) implemented, 22 documented for future phases. Each phase builds quality infrastructure before productivity tools.

---

## Notes

General development notes.
