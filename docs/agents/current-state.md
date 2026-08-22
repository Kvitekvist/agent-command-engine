# ACE Current State

## Snapshot

- Product: Agent Command Engine (ACE), an Electron application for managing
  Claude and Codex CLI agents.
- Current application version: **0.1.17** (from `src/package.json` and
  `version.txt`).
- Runtime: Electron main process, React renderer, preload IPC bridge, and a
  forked PTY host.
- Test/build commands: from `src/`, `cmd /c npm test` and
  `cmd /c npm run build`.

## Active priorities

1. Complete the modularity and agent-guidance work tracked by TICKET-0072
   through TICKET-0081.
2. Preserve the existing manual-verification backlog while making changes;
   consult the relevant open ticket before changing terminal, screenshot,
   project-history, or cross-platform behavior.
3. Treat the Electron app under `src/` as canonical. The .NET migration claim
   in historical project notes has no corresponding `.sln` or `.csproj` in
   this repository.

## Known operational constraints

- Interactive agents run through PTYs; do not replace that path with the old
  headless prompt path without an explicit product decision.
- `tokscale` supplies live token data; provider failures must remain isolated.
- On a restrictive filesystem sandbox, tests that call `mkdtemp` can fail
  before their assertions. This is an environment limitation until
  TICKET-0081 is completed.

## Where to look next

Use [task routing](START.md) to select the smallest relevant context set.
For a detailed legacy implementation narrative, search rather than read the
full `.claude/memory/architecture.md` and `ticket_memory.md` files.
