# TICKET-0093 — Provider-neutral routing backed by the node-map second brain

**Status**

Closed

**Type**

Refactor

**Priority**

High

**Created**

2026-08-22

---

## Description

Rebuild the agent routing layer as a single provider-neutral entry point backed
by the node-map second brain, replacing the two-hop prose routing that no
non-Claude agent fully receives.

## Reason

An assessment of the routing layer found six defects:

1. **The second brain was not installed here.** The `node-map` skill and
   `brain.js` existed only in the SecondBrainNodes repository. ACE had no
   `.claude/skills/` directory and no `docs/node-map.html`, so the
   deterministic retrieval protocol that skill defines was unreachable from
   this project. Routing was 100% prose and every "where is X" question fell
   back to an open-ended Grep/Glob sweep.

2. **Provider neutrality was nominal.** `AGENTS.md` existed, but the rules
   that actually get enforced — the `[TICKET-####]` commit format, the
   definition of done, the branch strategy, "every change needs a ticket" —
   lived only in `.claude/CLAUDE.md`, which Codex never reads. A Codex agent
   working in this repository would commit with the wrong message format and
   skip the ticket workflow entirely. ACE manages both Claude and Codex
   agents, so this gap is self-inflicted.

3. **Routing cost two hops.** `AGENTS.md` routed to `docs/agents/START.md`,
   which then routed to the task documents, and both files separately
   described document ownership — two reads and two places to drift before
   any work began.

4. **Version drift across five files.** `src/package.json` and `version.txt`
   said 0.1.18; `docs/agents/current-state.md` said 0.1.17; `README.md` and
   `.claude/memory/project_status.md` said 0.1.1; and
   `.claude/memory/tech_stack.md` contradicted itself within six lines
   (canonical 0.1.17 on line 5, `Version: 0.1.1` on line 11).

5. **The memory index advertised stale files as current.**
   `.claude/memory/MEMORY.md` described `project_status.md` as "Current
   milestone, version, and progress" while that file's own first line called
   itself a historical snapshot.

6. **Finished tickets were still Open.** TICKET-0072 and TICKET-0073 had every
   plan item checked and a Result written but `Status: Open`, so the
   `tickets/open/` queue — the thing every agent is told to search first —
   reported completed work as available. TICKET-0073's claim to have
   synchronized versions was also false (see defect 4).

## Implementation Plan

* [x] Install the `node-map` skill (`SKILL.md`, `brain.js`, `template.html`) into `.claude/skills/`
* [x] Generate `docs/node-map.html` for this repository, with ticket nodes labelled by description so `brain.js` can retrieve them by topic instead of by opaque ticket number
* [x] Rewrite `AGENTS.md` as the single provider-neutral entry point: retrieval protocol, task routing, ticket workflow, commit format, definition of done, validation
* [x] Merge `docs/agents/START.md` into `AGENTS.md` and remove it, collapsing the two-hop route to one
* [x] Reduce `.claude/CLAUDE.md` to a thin pointer plus genuinely Claude-specific notes
* [x] Resolve version drift to one canonical statement and fix every file that restates it
* [x] Relabel `.claude/memory/MEMORY.md` as a historical index
* [x] Give every open ticket a titled H1 so `grep -h '^# TICKET' tickets/open/*.md` is a zero-maintenance queue index
* [x] Close TICKET-0072 and TICKET-0073 after genuinely completing their stated criteria

## Files Modified

- AGENTS.md — rewritten as the single provider-neutral entry point
- docs/agents/START.md — removed, merged into AGENTS.md
- docs/agents/current-state.md — version corrected, routing pointer updated
- .claude/CLAUDE.md — reduced from 190 lines to a 47-line Claude-specific pointer
- .claude/skills/node-map/SKILL.md — documents the `keywords` field and ACE's generator
- .claude/skills/node-map/assets/brain.js — optional `keywords` field, scored at weight 2
- .claude/skills/node-map/assets/template.html — installed unchanged
- scripts/build-node-map.js — new committed generator
- docs/node-map.html — generated (11 categories, 180 nodes)
- .claude/memory/MEMORY.md — relabelled as a historical index
- .claude/memory/tech_stack.md — self-contradicting version block removed
- .claude/memory/project_status.md — stale version heading marked superseded
- README.md — version pointer instead of a restated number
- tickets/TEMPLATE.md — titled H1 requirement and status vocabulary
- tickets/open/*.md — 39 tickets given titled H1s
- tickets/closed/TICKET-0072.md, TICKET-0073.md — closed
- CHANGELOG.md

## Testing

* [x] `npm test` from `src/` — 66 passed, 1 skipped (POSIX-only), 0 failed
* [x] All Markdown links across the repository resolve (0 broken)
* [x] `node scripts/build-node-map.js` regenerates cleanly from a clean checkout path
* [x] `brain.js` retrieval benchmarked on 8 realistic queries: 6/8 correct
      before the `keywords` change, 7/8 after, with the two previously wrong
      answers ("definition of done", "conventions for the renderer") now
      resolving to `AGENTS.md` and `docs/agents/conventions.md`

## Result

Implemented. Routing is now one hop: `AGENTS.md` alone carries the retrieval
protocol, task routing, ticket workflow, commit format, definition of done,
and validation commands, so a Codex agent receives the same rules a Claude
agent does. `.claude/CLAUDE.md` no longer restates any of it.

The second brain is installed and wired in. `brain.js` answers "where is X"
from a 180-node index without opening a file, and two ACE-specific labelling
decisions make it usable here: ticket nodes carry their description (so
tickets are findable by topic, not number) and a curated `keywords` map
covers documents whose filename doesn't match how anyone would ask for them.

Version is stated once, in `src/package.json` and `version.txt`. Every other
file now points at them.

## Notes

The `keywords` addition to `brain.js` is backward compatible — nodes without
the field score exactly as before — but it currently exists only in ACE's
copy. The same ~15-line change should be ported to the canonical engine in
the SecondBrainNodes repository under a ticket there, or the two copies will
drift.

Considered and rejected: renaming ticket files to
`TICKET-0072-agent-entry-point.md` to make them retrievable by name. It would
have broken every cross-reference in `ticket_memory.md`, `CHANGELOG.md`, and
the commit history. Folding the description into the node-map label achieves
the same retrieval benefit with no renames.

## Closed

2026-08-22
