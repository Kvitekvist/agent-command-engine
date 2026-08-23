# Ticket Category System

## Overview

Tickets are organized into category subfolders to improve navigation and maintainability as the project scales.

## Structure

```
tickets/
├── open/
│   ├── features/           # New functionality
│   ├── bugs/               # Bug fixes
│   ├── documentation/      # Docs, comments, guides
│   ├── infrastructure/     # Build, CI/CD, tooling
│   └── research/           # Investigation, analysis, POCs
├── closed/
│   ├── features/
│   ├── bugs/
│   ├── documentation/
│   ├── infrastructure/
│   └── research/
└── archived/
    ├── features/
    ├── bugs/
    ├── documentation/
    ├── infrastructure/
    └── research/
```

## Categories

### features
New functionality, enhancements, user-facing improvements.

**Examples**:
- Add login window
- Implement dark mode
- Create export functionality

### bugs
Defects, errors, incorrect behavior that needs fixing.

**Examples**:
- Fix crash on startup
- Resolve memory leak
- Correct calculation error

### documentation
Documentation updates, code comments, guides, READMEs.

**Examples**:
- Update API documentation
- Add inline comments
- Create user guide

### infrastructure
Build systems, CI/CD, tooling, project setup, development environment.

**Examples**:
- Configure GitHub Actions
- Add linting rules
- Update build scripts

### research
Investigation, analysis, proof-of-concepts, technology evaluation.

**Examples**:
- Evaluate framework options
- Performance profiling
- Security audit

## Choosing a Category

1. Read the ticket's **Type** field (Feature/Bug/Enhancement)
2. Consider the primary purpose:
   - Does it add new functionality? → **features**
   - Does it fix broken behavior? → **bugs**
   - Is it about documentation? → **documentation**
   - Does it improve tooling/build/CI? → **infrastructure**
   - Is it investigative work? → **research**

3. When in doubt:
   - Enhancement of existing features → **features**
   - Refactoring without new features → **infrastructure**
   - Writing guides/docs → **documentation**

## Creating New Tickets

When creating a ticket:

1. Run `scripts\next_ticket.bat` to get the next ticket number
2. Determine the appropriate category
3. Create the ticket file:
   ```
   tickets/open/[category]/NNNN-Short Title.md
   ```
4. Fill in the **Category** field in the ticket template

## Migrating Existing Tickets

For tickets in the flat structure (`tickets/open/NNNN-Title.md`):

1. Run `scripts\migrate_tickets.bat` to see existing tickets
2. For each ticket:
   - Open and read the Type field
   - Determine appropriate category
   - Move file to `tickets/open/[category]/`
   - Update the Category field

## Benefits

- **Faster navigation**: Find related tickets quickly
- **Better organization**: Group similar work together
- **Scalability**: Handles hundreds of tickets cleanly
- **Context**: Category provides instant context about ticket purpose

## Backward Compatibility

- Flat structure still works (tickets/open/NNNN-Title.md)
- Existing workflows unchanged
- Migration is optional but recommended
- Scripts support both structures

## Tools

- **scripts/migrate_tickets.bat**: Migration helper and ticket listing
- **scripts/next_ticket.bat**: Safe ticket number generation (unchanged)

## Workflow Integration

The category system integrates with existing workflows:

1. **new-ticket skill**: Will prompt for category when creating tickets
2. **Ticket template**: Includes Category field
3. **Git branches**: Still use `feature/TICKET-NNNN` or `bugfix/TICKET-NNNN`
4. **Commit messages**: Still use `[TICKET-NNNN] Description`

Category is an organizational aid, not a workflow constraint.
