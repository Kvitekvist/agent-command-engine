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
  `bash scripts/run_tests.sh`. Last full run: 69 passed, 1 skipped
  (POSIX-only), 0 failed.

## Active priorities

1. The 2026-08-30 backlog triage closed the pure-decomposition refactors
   (TICKET-0074, 0076, 0077, 0078, 0080) and two speculative features
   (TICKET-0087, 0090) as won't-do — they added files without behaviour for
   an app this size. TICKET-0083 closed by removing the dead `prompts`-table
   analytics rather than rebuilding them. TICKET-0075 closed with just its
   security half: `resolveProjectRoot` in `handlers.js` now confines every
   fs/git/build/screenshot/agent path to a registered project, and every IPC
   handler runs a sender check (`assertAppSender`). The remaining structural
   ticket is TICKET-0079 (main-owned session lifecycle). Do not reopen the
   closed refactors without a concrete pain point.
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
