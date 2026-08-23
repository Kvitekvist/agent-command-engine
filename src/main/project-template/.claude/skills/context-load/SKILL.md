---
name: context-load
description: Use this skill at the start of every session, in place of a blind full read of the memory files CLAUDE.md's "Every Session" checklist names. Loads only what's relevant to the current task instead of everything ever recorded, and knows to check the archive files under .claude/memory/archive/ when the live files aren't enough. Triggers automatically whenever you're about to read project_memory.md, ticket_memory.md, or architecture.md at session start.
version: 1.0.0
---

# Loading session context without burning the whole budget on it

CLAUDE.md's "Every Session" checklist says to read `project_memory.md`,
`architecture.md`, and `ticket_memory.md` before writing code. Taken
literally as "read the whole file," that checklist used to cost about
627KB (~150K+ tokens) every single session — most of it historical
narrative about tickets closed months ago, irrelevant to whatever the
current request actually is. As of 2026-08-03 the live files were trimmed
(old entries moved to `.claude/memory/archive/`, see the `memory-archive`
skill), which already cuts that by ~75% — but the habit of reading files
in full instead of retrieving what's relevant is the thing that let them
grow to that size in the first place. Don't rebuild the problem.

## What to actually do

1. **Read `project_memory.md` in full.** It's ~600 lines now (trimmed
   specifically to be full-readable) — Vision, Current Milestone,
   Conventions, Active Priorities, Technical Debt, Known Issues, a handful
   of the most recent Completed entries, Future Ideas, and Notes (a dense
   reference list of durable gotchas, not a chronological log — genuinely
   worth reading in full). This is the one file where a full read is the
   right call.

2. **Read `architecture.md` in full** if the task touches structure you're
   not already confident about. It's ~300 lines, current-state
   documentation, not a growing log — no archival concern here.

3. **Don't read `ticket_memory.md` in full by default.** Instead:
   - If the current task references a specific ticket number, `grep` for
     it directly (live file first, then `archive/ticket_memory_pre-0366.md`
     if not found there).
   - If the task is about a feature area (e.g. "the Join tool", "pushdown",
     "the account server"), `grep -i` for that keyword across both the
     live file and the archive, and read only the matching entries with
     surrounding context — not the whole file around them.
   - Only read the live `ticket_memory.md` in full if you're doing
     something that genuinely needs the full recent picture (e.g.
     reconstructing what shipped in the last two weeks for a status
     summary) — and even then, that's the ~1,300-line live file, not the
     6,300-line archive behind it.

4. **Never read an `.claude/memory/archive/*.md` file in full.** They exist
   specifically so you don't have to — `grep` only. If a grep comes back
   empty and you suspect the information is genuinely there, widen the
   search term before falling back to a full read, and treat a full
   archive read as a deliberate, unusual decision worth a one-line note to
   the user about why (e.g. "grepping isn't finding it, doing a full
   archive read to check").

5. **Scan open tickets and the current milestone** as CLAUDE.md's checklist
   already says — `tickets/open/` is a directory listing (Glob), not a
   file to read in full; open individual ticket files only for the ones
   relevant to the current request.

## Expert Analysis Capability

When researching patterns or implementing features, consider analyzing expert practitioners:

1. **Identify experts**: If user provides GitHub accounts or mentions specific developers, analyze their repositories

2. **Deep-dive analysis**:
   - List all repositories with descriptions, stars, topics
   - Identify patterns in their workflow, tools, project structures
   - Extract methodologies and frameworks (e.g., Four Cs, Three Ms, gauntlet loop)
   - Analyze specific key projects for implementation details

3. **Document findings** in separate expert analysis file:
   - Extract proven methodologies that can be reused
   - Identify architectural principles
   - Cite specific repositories and projects

4. **Integration**: Combine expert patterns with industry research for comprehensive recommendations

**Example**: Analyzing nateherkai (AIS-OS, token-dashboard) and robonuggets (gauntlet-loop, calibrate) yielded Four Cs framework, quality bar methodology, and self-improvement patterns that wouldn't be found in generic research.

**When to use**: 
- Implementing complex features (skill systems, quality frameworks)
- Research requests that mention specific developers
- When generic industry sources lack concrete implementation patterns

## Why this is safe

Nothing was deleted in the trim — every historical entry still exists,
either in the live file or the archive, and each closed ticket's own file
under `tickets/closed/` remains the actual source of truth for that
ticket's full detail regardless of what `ticket_memory.md` says about it.
Grepping instead of reading doesn't lose information; it just defers
loading it until it's actually relevant.
