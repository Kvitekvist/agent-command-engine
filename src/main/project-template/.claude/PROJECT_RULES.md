# Development Rules

Every code modification belongs to a ticket.

Every ticket must contain:

Description

Reason

Implementation

Files Changed

Testing

Result

Never commit unfinished work.

---

## Ticket Decomposition

Large requests SHOULD be decomposed into:

- One **parent ticket** describing the overall goal
- Multiple **child tickets** for each logical component
- Clear **dependencies** between tickets

**Decompose when**:
- Request involves 3+ distinct features
- Work spans multiple architectural layers
- Would require 5+ commits
- Parts can be tested independently

**Do NOT decompose when**:
- Feature is cohesive (even if large)
- All parts tightly coupled
- User requests atomic implementation

See `.claude/prompts/decomposition.md` for full workflow.

Always update:

ticket

ticket memory

README if user-facing

Architecture if structure changes

---

## Definition of Done

A ticket is complete only when:

- Code implemented
- Tested
- Documentation updated
- Memory updated
- No obvious regressions
- Successfully committed