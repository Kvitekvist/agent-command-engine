# ACE Agent Guide

Entry point for every coding agent working in Agent Command Engine (ACE) —
Claude Code, Codex, or anything else. This file is provider-neutral and is the
only document you must read before changing the repository.

## Start here

1. Read [current state](docs/agents/current-state.md) — version, active
   priorities, known constraints.
2. Use the routing table below to pick the *smallest* set of further documents.
3. Find the ticket for your work (see **Ticket workflow**). Every change
   belongs to one.

## Finding things: query the node map first

This repository has a second brain: `docs/node-map.html` indexes every
memory file, ticket, source module, script, and doc. Before an open-ended
Grep/Glob sweep for "where is X" or "which file does Y", run:

```bash
node .claude/skills/node-map/assets/brain.js "<your question>"
```

It scores every known file by filename, path, and category — no file content
read, no model call — and prints a ranked shortlist. Read the top result (or
top two if the scores are close) instead of searching further.

- Exit `0` with results: use them.
- Exit `1` ("no candidates matched"): fall back to Grep/Glob. A miss is not
  an error.
- A "low confidence" warning means several files tied; `brain.js` has no
  content index, so skim the top few rather than trusting one.
- `--json` for structured output, `--top N` to widen the list.

Ticket nodes are labelled with their description, so
`brain.js "terminal lifecycle"` finds TICKET-0077 without you knowing its
number. Regenerate the map with `node scripts/build-node-map.js` after large
structural changes — check the `generated` timestamp inside
`docs/node-map.html` if results look stale.

Open `docs/node-map.html` in a browser to explore the same data visually.

## Task routing

| Task | Read first | Then only if needed |
| --- | --- | --- |
| Small UI or main-process fix | Current state, matching ticket | [Architecture guide](docs/agents/architecture-guide.md), the affected service/component |
| Cross-process / IPC change | Current state, ticket, architecture guide | `src/main/preload.js` and both call sites |
| New feature | Current state, ticket, [conventions](docs/agents/conventions.md) | Architecture guide, related closed ticket |
| Refactor | Current state, ticket, conventions | Architecture guide, directly affected tests |
| Release / packaging | Current state, `CHANGELOG.md`, `src/package.json` | Build scripts, `electron-builder` config |
| Investigating older behavior | Current state, matching ticket | `brain.js`, then search `.claude/memory/ticket_memory.md` — never read it end to end |

## Canonical sources

| Need | Source |
| --- | --- |
| Version | `src/package.json` and `version.txt` — nothing else is authoritative |
| Current priorities and constraints | [Current state](docs/agents/current-state.md) |
| System boundaries and data flow | [Architecture guide](docs/agents/architecture-guide.md) |
| Coding and test conventions | [Conventions](docs/agents/conventions.md) |
| Active work | `tickets/open/` |
| Completed work | `tickets/closed/` |
| History (search, don't read) | `.claude/memory/ticket_memory.md`, `.claude/memory/architecture.md` |
| Release history | `CHANGELOG.md` |

`tickets/` is the only active ticket system. `.claude/tickets/` and
`.claude/memory/project_status.md` are legacy copies, retained for history
and not to be treated as current. If two documents disagree, prefer
executable configuration for versions and the active ticket for work state,
then correct the stale document as part of your ticket.

## Ticket workflow

Every feature, bug fix, and refactor needs a ticket — no exceptions.

1. Search the queue before starting:
   `grep -h '^# TICKET' tickets/open/*.md` lists every open ticket by title.
2. Continue the matching ticket, or create `tickets/open/TICKET-####.md` from
   [`tickets/TEMPLATE.md`](tickets/TEMPLATE.md) using the next free number.
   Give it a titled H1: `# TICKET-0094 — Short description`.
3. Record the implementation plan *before* changing code.
4. Keep Files Modified and Testing current as you work.
5. Move it to `tickets/closed/` only when its stated criteria are genuinely
   met — set `Status` to `Closed` and fill the `Closed` date. Never leave a
   finished ticket Open; the queue is what every agent searches first.

**Status vocabulary:** `Open` (actionable), `Awaiting verification`
(implemented and committed, needs a live manual check — do not re-implement),
`Blocked` (needs a user decision), `Closed`.

## Definition of done

Before committing, verify:

- Code builds
- Tests pass
- The active ticket's plan, Files Modified, Testing, and Result are current
- `CHANGELOG.md` updated for user-facing changes
- README or the relevant `docs/agents/` file updated if its facts changed
- Version bumped in `src/package.json` and `version.txt` if releasing

If any check fails, do not commit.

## Git

- Commit message format: `[TICKET-####] Short description`.
- Never commit unrelated changes. Preserve working-tree changes outside your
  ticket — do not reset, revert, or reformat them.
- Branches: `main`, `develop`, `feature/<ticket>`, `bugfix/<ticket>`.
- Do not push unless asked; this project does not auto-push.

## Working rules

- Treat `src/main`, `src/renderer`, and `src/main/preload.js` as separate
  trust boundaries. Changes crossing them need an explicit IPC contract.
- Keep behaviour-preserving refactors small and independently testable.
- Prefer extending focused services or hooks over adding branches to large
  coordinator modules.
- Interactive agents run through PTYs. Do not replace that path with the old
  headless prompt path without an explicit product decision.
- Never leave dead code or unused imports behind.

## Validation

From `src/`:

```bash
npm test     # node --test tests/*.test.js
npm run build
```

`bash scripts/run_tests.sh` runs the same suite from the repository root and
is what CI uses. On Windows without a POSIX shell, use `cmd /c npm test`.

The suite needs a writable temporary directory; filesystem tests that call
`mkdtemp` can fail before their assertions in a restricted sandbox — that is
an environment limitation, not a regression (TICKET-0081).
