# Ticket Categories

All tickets should be categorized to maintain organization and enable efficient searching.

## Feature Tickets

Feature tickets should be placed in:
- `tickets/open/feature/` - Active feature development
- `tickets/closed/feature/` - Completed features

### Feature Categories

- **ui/** - User interface changes and improvements
- **api/** - Backend API development
- **integration/** - Third-party integrations
- **performance/** - Performance optimizations
- **tooling/** - Development tools and workflows
- **testing/** - Test infrastructure and coverage
- **documentation/** - Documentation improvements
- **security/** - Security enhancements

## Bug Tickets

Bug tickets should be placed in:
- `tickets/open/bug/` - Active bug investigations
- `tickets/closed/bug/` - Resolved bugs

### Bug Severity Levels

- **critical/** - System crashes, data loss, security vulnerabilities
- **high/** - Major functionality broken, significant UX issues
- **medium/** - Moderate impact on functionality
- **low/** - Minor issues, cosmetic problems

## Research Tickets

Research and investigation tickets:
- `tickets/open/research/` - Active research
- `tickets/closed/research/` - Completed research

## Archive

Tickets that are no longer relevant:
- `tickets/archived/` - Cancelled, obsolete, or superseded tickets

---

## File Naming Convention

`TICKET-####.md` where #### is a zero-padded 4-digit number.

Examples:
- `TICKET-0001.md`
- `TICKET-0042.md`
- `TICKET-0123.md`

---

## Current Structure

The project currently uses a flat structure:
- `tickets/open/` - All open tickets
- `tickets/closed/` - All closed tickets
- `tickets/archived/` - Archived tickets

**Future Enhancement**: Consider adopting the categorized structure above as the project grows.
