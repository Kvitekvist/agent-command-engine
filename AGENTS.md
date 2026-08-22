# ACE Agent Guide

This is the entry point for every coding agent working in Agent Command Engine
(ACE). Read this file before changing the repository.

## Fast route

1. Read [current state](docs/agents/current-state.md).
2. Read [task routing](docs/agents/START.md), then only the documents it
   selects for the task at hand.
3. Search `tickets/open/` before starting work. Continue the matching ticket
   or create one from `tickets/TEMPLATE.md`.
4. Preserve unrelated working-tree changes. Do not reset, revert, or reformat
   files outside the active ticket.
5. Run the ticket's relevant checks before marking it complete.

## Canonical sources

| Need | Source |
| --- | --- |
| Current version, priorities, and known verification work | [Current state](docs/agents/current-state.md) |
| Which documents to read for a task | [Task routing](docs/agents/START.md) |
| Stable system boundaries and data flow | [Architecture guide](docs/agents/architecture-guide.md) |
| Coding and test conventions | [Conventions](docs/agents/conventions.md) |
| Active work | `tickets/open/` |
| Completed-work history | `tickets/closed/` and `.claude/memory/ticket_memory.md` (search only) |
| Release history | `CHANGELOG.md` and `src/package.json` |

`tickets/` is the canonical ticket system. The legacy `.claude/tickets/`
directory is not an active work queue.

## Working rules

- Treat `src/main`, `src/renderer`, and `src/main/preload.js` as separate
  trust boundaries. Changes crossing them need an explicit IPC contract.
- Keep behaviour-preserving refactors small and independently testable.
- Prefer extending focused services or hooks over adding branches to large
  coordinator modules.
- Update the active ticket as work progresses. Update the current-state or
  architecture guide only when their respective facts change.
- Do not require historical ticket-memory reading for ordinary tasks; search
  it by ticket number or feature term when historical context is needed.

## Validation

From `src/`, run `cmd /c npm test` and `cmd /c npm run build` for changes that
affect application code. The test suite needs an allowed temporary directory;
filesystem tests may be blocked in restricted sandboxes.
