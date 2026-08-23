---
name: memory-archive
description: Use this skill when project_memory.md or ticket_memory.md (or any future memory file) has grown large enough that reading it in full is a real token cost again — roughly a few hundred KB or a few hundred entries. Documents the archival convention established 2026-08-03 (ticket_memory.md 421KB->75KB, project_memory.md 205KB->66.5KB) so the next pass follows the same pattern instead of reinventing it, or worse, not doing it and letting the file keep growing forever. Triggers on "these memory files are huge", "archive old tickets", "trim the memory files".
version: 1.0.0
---

# Archiving old memory entries

`ticket_memory.md` and `project_memory.md` are append-only logs by
convention (CLAUDE.md: "Append entries only"). Append-only with no
periodic archival means unbounded growth — by 2026-08-03 they'd reached
421KB/7,627 lines and 205KB/2,747 lines respectively, both mandated full
reads at the start of every session (see the `context-load` skill for the
token cost that created). This isn't a one-time cleanup; it'll happen
again. This skill documents how to do it the same way each time.

## The pattern

1. **Never delete content.** Move it to `.claude/memory/archive/`. Every
   historical entry must remain findable via grep after the move.

2. **Split on a clean structural boundary**, not an arbitrary line count:
   - `ticket_memory.md`: entries are separated by `---` delimiter lines.
     Pick a delimiter near your target cutoff, verify the next line starts
     a new `TICKET-####` entry cleanly (check for stray double-delimiters
     — one existed at the 2026-08-03 cutoff, two adjacent `---` lines with
     a blank line between, from what looks like a dropped entry title).
   - `project_memory.md`: distinguish **current-state sections** (Vision,
     Current Milestone, Conventions, Active Priorities, Technical Debt,
     Known Issues, Future Ideas, Notes) from **historical log sections**
     ("Completed This Session" and any versioned "Completed This Session
     (vX.Y.Z)" subsections). Only the historical log sections are
     archival candidates — current-state sections stay live and complete
     no matter how the file grows elsewhere. The 2026-08-03 archive
     specifically found the "Notes" section (despite its generic name) is
     a dense reference list of durable architectural gotchas, not a
     chronological log — that stays live too.

3. **Pick the cutoff by recency, not an even split.** The 2026-08-03 pass
   kept roughly the most recent 1-2 weeks of ticket activity live
   (everything from TICKET-0366/2026-07-27 onward) and archived
   everything older — recent work is disproportionately likely to be
   relevant to whatever's being worked on next; a ticket from months ago
   is something to grep for, not something that needs to already be in
   context.

4. **Use `sed -n 'START,ENDp' file > archive_file`** (via Bash) for the
   actual split, not Read+Write — reading the full old file into context
   just to write it back out defeats the purpose of this whole exercise.
   Verify line counts add up (`wc -l` on original vs. archive+live) and
   spot-check a known-old and known-recent ticket number with `grep -c`
   across both files before trusting the split.

5. **Leave a pointer note** at the top of the live file's now-empty space,
   explaining what moved where, that nothing was deleted, and to grep the
   archive rather than read it in full. Follow the existing notes in
   `ticket_memory.md`/`project_memory.md` as the template — same tone,
   same structure.

6. **Name archive files by what they contain**, not by date of archiving —
   `ticket_memory_pre-0366.md`, not `ticket_memory_archive_1.md` — so a
   future grep-empty search knows which archive file might still have the
   answer without opening each one to check.

## When to run this again

Check file size (`wc -lc`) as part of any session that already has
`ticket_memory.md`/`project_memory.md` open. If the live file has grown
back past roughly 150-200KB or a few hundred entries, it's time for
another pass — don't wait for it to reach 400KB+ again before addressing
it.
