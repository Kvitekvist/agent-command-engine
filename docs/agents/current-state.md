# ACE Current State

## Snapshot

- Product: Agent Command Engine (ACE), an Electron application for managing
  Claude and Codex CLI agents.
- Current application version: **0.1.18**. `src/package.json` and
  `version.txt` are the only authoritative sources — this line is a
  convenience copy, so trust them if it drifts.
- Runtime: Electron main process, React renderer, preload IPC bridge, and a
  forked PTY host.
- Test/build: from `src/`, `npm test` and `npm run build`. CI runs
  `bash scripts/run_tests.sh`. Last full run: 66 passed, 1 skipped
  (POSIX-only), 0 failed.

## Active priorities

1. Complete the modularity and agent-guidance work tracked by TICKET-0072
   through TICKET-0081, and the routing work in TICKET-0093.
2. Preserve the existing manual-verification backlog while making changes.
   Several tickets are implemented and committed but await a live check;
   consult the relevant open ticket before changing terminal, screenshot,
   project-history, or cross-platform behavior, and do not re-implement work
   that is only awaiting verification.
3. Treat the Electron app under `src/` as canonical. The .NET migration claim
   in historical project notes (TICKET-0015) has no corresponding `.sln` or
   `.csproj` in this repository and needs a user decision.

## Known operational constraints

- Interactive agents run through PTYs; do not replace that path with the old
  headless prompt path without an explicit product decision.
- `tokscale` supplies live token data; provider failures must remain isolated.
- On a restrictive filesystem sandbox, tests that call `mkdtemp` can fail
  before their assertions. This is an environment limitation until
  TICKET-0081 is completed.

## Where to look next

Use the task-routing table in the repository-root [AGENTS.md](../../AGENTS.md)
to select the smallest relevant context set, and
`node .claude/skills/node-map/assets/brain.js "<question>"` to locate a
specific file. For a detailed legacy implementation narrative, search rather
than read `.claude/memory/architecture.md` and `.claude/memory/ticket_memory.md`.
