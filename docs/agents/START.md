# Task Routing for ACE Agents

Start with the repository-root [AGENTS.md](../../AGENTS.md). This document
keeps context loading proportional to the task instead of asking agents to
read the project history on every session.

| Task | Read first | Then read only if needed |
| --- | --- | --- |
| Small UI or main-process fix | [Current state](current-state.md), matching open ticket | [Architecture guide](architecture-guide.md), affected service/component |
| Cross-process / IPC change | Current state, matching ticket, architecture guide | Preload and both call sites |
| New feature | Current state, matching/new ticket, conventions | Architecture guide and related closed ticket |
| Refactor | Current state, matching ticket, conventions | Architecture guide and directly affected tests |
| Release / packaging | Current state, `CHANGELOG.md`, `src/package.json` | Build scripts and package configuration |
| Investigating older behavior | Current state and matching ticket | Search `.claude/memory/ticket_memory.md`; do not read it end-to-end |

## Ticket workflow

1. Search `tickets/open/` for the work.
2. Continue the existing ticket or create `TICKET-####.md` from
   `tickets/TEMPLATE.md`.
3. Record the implementation plan before code changes.
4. List changed files and verification results in the ticket.
5. Move a ticket to `tickets/closed/` only after its stated completion and
   verification criteria are met.

## Documentation ownership

- `AGENTS.md`: short, universal operating instructions.
- `docs/agents/current-state.md`: current facts and active priorities.
- `docs/agents/architecture-guide.md`: stable boundaries and navigation;
  detailed legacy notes remain in `.claude/memory/architecture.md`.
- `.claude/memory/ticket_memory.md`: append-only historical summaries,
  searched on demand.

If two documents disagree, prefer executable configuration for versions and
the active ticket for work state; correct the documentation as part of the
active ticket.
