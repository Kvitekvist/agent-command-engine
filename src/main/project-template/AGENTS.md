# Agent Guide

Entry point for every coding agent working in this repository — Claude Code,
Codex, or anything else. This file is provider-neutral and is the only
document you must read before changing the repository.

Replace the placeholders below (project name, stack, validation commands) when
this template is initialised for a real project. `.claude/project_config.md`
holds the machine-readable copy of the same facts.

## Start here

1. Read [current state](docs/agents/current-state.md) — version, active
   priorities, known constraints.
2. Use the routing table below to pick the *smallest* set of further documents.
3. Find the ticket for your work (see **Ticket workflow**). Every change
   belongs to one.

Never assume the architecture. Never start implementing before the project
skeleton exists (see [`.claude/PROJECT_SKELETON.md`](.claude/PROJECT_SKELETON.md)).

## Finding things: query the node map first

This repository has a second brain: `docs/node-map.html` indexes every memory
file, ticket, source module, script, and doc. Before an open-ended Grep/Glob
sweep for "where is X" or "which file does Y", run:

```bash
node .claude/skills/node-map/assets/brain.js "<your question>"
```

It scores every known file by filename, path, category, and curated keywords —
no file content read, no model call — and prints a ranked shortlist. Read the
top result (or top two if the scores are close) instead of searching further.

- Exit `0` with results: use them.
- Exit `1` ("no candidates matched"): fall back to Grep/Glob. A miss is not
  an error.
- A "low confidence" warning means several files tied; `brain.js` has no
  content index, so skim the top few rather than trusting one.
- `--json` for structured output, `--top N` to widen the list.

Ticket nodes are labelled with their description, so
`brain.js "login window"` finds the ticket without you knowing its number.
Regenerate the map with `node scripts/build-node-map.js` (or
`scripts\build_node_map.bat` / `bash scripts/build_node_map.sh`) after large
structural changes, and commit the regenerated map with the change that made
it stale. Open the same file in a browser to explore it visually.

## Task routing

| Task | Read first | Then only if needed |
| --- | --- | --- |
| Small fix | Current state, matching ticket | [Architecture guide](docs/agents/architecture-guide.md), the affected module |
| New feature | Current state, ticket, [conventions](docs/agents/conventions.md) | Architecture guide, related closed ticket |
| Large feature (3+ components or layers) | [Decomposition prompt](.claude/prompts/decomposition.md) | Architecture guide |
| Refactor | Current state, ticket, conventions | Architecture guide, affected tests |
| Release / packaging | Current state, `CHANGELOG.md`, `version.txt` | [Release prompt](.claude/prompts/release.md), build scripts |
| Investigating older behaviour | Current state, matching ticket | `brain.js`, then search `.claude/memory/ticket_memory.md` — never read it end to end |

## Canonical sources

| Need | Source |
| --- | --- |
| Version | `version.txt` (plus the language's own manifest, if any) — nothing else is authoritative |
| Stack, build tool, workflow flags | `.claude/project_config.md` |
| Current priorities and constraints | [Current state](docs/agents/current-state.md) |
| System boundaries and data flow | [Architecture guide](docs/agents/architecture-guide.md) |
| Coding and test conventions | [Conventions](docs/agents/conventions.md) |
| Active work | `tickets/open/` |
| Completed work | `tickets/closed/` |
| History (search, don't read) | `.claude/memory/ticket_memory.md`, `.claude/memory/architecture.md` |
| Release history | `CHANGELOG.md` |

If two documents disagree, prefer executable configuration for versions and
the active ticket for work state, then correct the stale document as part of
your ticket.

## Ticket workflow

Every feature, bug fix, and refactor needs a ticket — no exceptions.

1. Search the queue before starting:
   `grep -rh '^# TICKET' tickets/open/` lists every open ticket by ID.
2. Continue the matching ticket, or create a new one from
   [`tickets/TEMPLATE.md`](tickets/TEMPLATE.md) in the right category folder
   (`features`, `bugs`, `documentation`, `infrastructure`, `research` — see
   [docs/TICKET_CATEGORIES.md](docs/TICKET_CATEGORIES.md)). Get the next free
   number from `node scripts/next_ticket.js`, which checks `origin/main` as
   well as the local tree.
3. Record the implementation plan *before* changing code.
4. Create the branch: `feature/TICKET-####` or `bugfix/TICKET-####` from an
   up-to-date `main`. Never commit ticket work directly to `main`.
5. Keep Files Modified and Testing current as you work.
6. Move it to `tickets/closed/<category>/` only when its stated criteria are
   genuinely met — set `Status` to `Closed` and fill the `Closed` date. Never
   leave a finished ticket Open; the queue is what every agent searches first.

**Status vocabulary:** `Open` (actionable), `Awaiting verification`
(implemented and committed, needs a live manual check — do not re-implement),
`Blocked` (needs a user decision), `Closed`.

Large features (3+ components, multiple layers, clear dependencies) should be
decomposed into a parent ticket plus child tickets before implementation —
propose the breakdown and get approval first.

## Definition of done

Before committing, verify:

- On the ticket's branch, not `main`
- Code builds
- Tests pass
- The active ticket's plan, Files Modified, Testing, and Result are current
- `CHANGELOG.md` updated for user-facing changes
- README or the relevant `docs/agents/` file updated if its facts changed
- Ticket memory updated
- Version bumped in `version.txt` if releasing

If any check fails, do not commit.

## Git

- Commit message format: `[TICKET-####] Short description`.
- Never commit unrelated changes. Preserve working-tree changes outside your
  ticket — do not reset, revert, or reformat them.
- Branches: `main`, `feature/<ticket>`, `bugfix/<ticket>`.
- Push the ticket branch after a successful commit if `auto_push` is enabled
  in `.claude/project_config.md`; otherwise only when asked.

## Working rules

- Prefer readability. Keep functions and files small.
- Refactor instead of copy/paste; avoid duplicated logic.
- Keep behaviour-preserving refactors small and independently testable.
- Never leave dead code or unused imports behind.
- Update the docs that a change makes wrong, in the same commit.

## Writing code: take the highest rung that holds

Read the task and the code it touches first — trace the real flow end to end —
then stop at the first of these that works:

1. **Does this need to exist at all?** A speculative need is not a
   requirement. Say so in one line and skip it.
2. **Is it already in this codebase?** A helper, util, or pattern a few files
   over. Re-implementing what already exists is the most common failure.
3. **Does the standard library do it?** Use it.
4. **Does a native platform feature cover it?** A DB constraint over app code,
   CSS over JS, a built-in input type over a widget library.
5. **Does an already-installed dependency solve it?** Never add a new
   dependency for what a few lines can do.
6. **Can it be one line?** One line.
7. Only then: the minimum code that works.

No interface with one implementation, no factory for one product, no config
for a value that never changes, no scaffolding "for later". The shortest
working diff wins — but only once you understand the problem; the smallest
change in the wrong place is a second bug.

A bug report names a symptom. Before editing, check every caller of the
function you are about to touch: one guard in the shared function is a smaller
diff than a guard in each caller, and patching only the path the ticket names
leaves the sibling callers broken.

Never simplify away input validation at trust boundaries, error handling that
prevents data loss, security measures, accessibility basics, or anything the
ticket explicitly asked for.

Non-trivial logic (a branch, a loop, a parser, a money or auth path) leaves one
runnable check behind — the smallest thing that fails if the logic breaks.
Trivial one-liners need no test.

Mark a deliberate shortcut with a known ceiling in a comment naming the ceiling
and the upgrade path, so it can be found later:
`// shortcut: global lock, per-account locks if throughput matters`.

## Validation

```bash
bash scripts/run_tests.sh    # what CI runs
```

Also maintain `scripts/setup.{bat,sh}` (a clean machine should need one
command), `scripts/run.{bat,sh}`, `scripts/build.{bat,sh}`, and
`scripts/clear_cache.{bat,sh}`. If the project cannot build an executable,
document why in the architecture guide rather than deleting `build.bat`.

## Research tasks

When asked for "extensive research" or similar: search widely across several
angles, cite sources, and write the findings as a few focused documents rather
than one huge file — typically `RECOMMENDATIONS.md` (what to build),
`ANALYSIS.md` (how others do it), `STATUS.md` (implementation tracking), and
`SUMMARY.md` (overview). Readers can then pick what is relevant.
