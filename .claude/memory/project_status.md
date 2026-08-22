# Project Status (Historical Snapshot)

> This file is retained for historical context. For current version, active
> priorities, and routing, use [docs/agents/current-state.md](../../docs/agents/current-state.md)
> and the repository-root [AGENTS.md](../../AGENTS.md).

## Version at time of this snapshot

0.1.1 — long superseded. The current version lives in `src/package.json` and
`version.txt`; the ticket counts below are equally out of date.

---

## Current Milestone

Reliability Alpha

---

## Progress

Core prototype complete. Most Reliability Alpha work (TICKET-0019 through
TICKET-0034) is implemented and committed; what's left is working through
a live manual-verification backlog, not new development.

---

## Active Branch

main

---

## Ticket Summary

- **Closed** (implemented + manually verified) — 10: TICKET-0001, 0012,
  0013, 0014, 0017, 0018, 0022, 0023, 0032, 0035
- **Open, implemented + committed, pending manual verification only** — 14:
  TICKET-0011, 0016, 0019, 0020, 0021, 0024, 0025, 0026, 0027, 0028, 0029,
  0030, 0033, 0034 (see project_memory.md Active Priorities for the exact
  verification step per ticket)
- **Open, not started** — 1: TICKET-0031 (in-chat model switcher)
- **Open, stale/flagged, needs a user decision** — 1: TICKET-0015 (.NET
  migration) — see Notes

---

## Build Status

Passing as of the last commit (`npm run build`; installer produced)

---

## Test Status

Passing — 11 automated tests (`agent-service.test.js`,
`tokscale-service.test.js`)

---

## Last Commit

07e5e30 [TICKET-0033] Add Open/Open in Explorer/Run right-click menu to the file tree

---

## Next Priority

Work through the live manual-verification backlog (TICKET-0024–0030, 0033,
0034 first, since those are the most recent and least-verified). No new
feature work is blocked on this, but none of these tickets can move to
`tickets/closed/` until verified. After that, TICKET-0031 (in-chat model
switcher) is the only open ticket not yet started.

---

## Notes

TICKET-0018 (accurate token tracking via tokscale) completed on 2026-08-03.

TICKET-0015 (.NET migration) claims a scaffolded .NET 8 solution, a ported
DbService/AgentService, and a working WPF shell, but the repo has no
`.sln`/`.csproj` anywhere and `app/` (its stated home) contains only a
`.gitkeep`. There's no evidence the described work actually exists. This
was flagged before this update and remains unresolved — the active app
remains the Electron one under `src/`. Ask the user whether to discard
this ticket or locate/restore the described work before touching it again.

TICKET-0035 (standardize rounded corners to 3px) shipped 2026-08-09. Its
`src/tailwind.config.js` change was committed separately from an
unrelated, unexplained `src/.npmrc` change (both `allow-scripts` lines
removed) that was sitting in the same working tree — that `.npmrc` change
was left uncommitted since it isn't mentioned anywhere in the ticket and
looks accidental. Still flagged for the user; check before touching
`src/.npmrc` again.
