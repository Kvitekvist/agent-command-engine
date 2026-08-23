---
name: definition-of-done
description: Use this skill immediately before committing any ticket work in Flowgrid — it turns CLAUDE.md's "Before Every Commit" list and PROJECT_RULES.md's "Definition of Done" from prose you re-read each time into an actual checklist you run through. Triggers on "commit this", "close the ticket", "mark it done", or any point where you're about to say a ticket is complete.
version: 1.0.0
---

# Definition of Done — run this before every commit

CLAUDE.md and `PROJECT_RULES.md` both state the completion criteria in
prose. This skill exists so those criteria get *executed*, not just
recalled from memory each session — treat every item below as a command to
actually run or a file to actually open, not a box to mentally check off.

## The checklist

- [ ] **Fix verified with user's repro case** (bug fixes only) — if the user
      provided a specific workflow, dataset, or error to reproduce, verify
      the fix resolves that exact issue before marking the ticket as
      implemented. Not applicable to features or refactors.
- [ ] **Build.** `cd src && src/node_modules/.bin/vite build` — not
      `npx vite build`, which resolves a different, unrelated `vite`/
      `rolldown` install that fails to find `index.html`. This is a known
      gotcha, not a hypothetical.
- [ ] **Tests.** `cd src && npm test` (vitest). Note the full suite count
      before and after — "full suite N/N" is the standard phrasing used
      throughout `ticket_memory.md`; if the count includes pre-existing
      unrelated failures (there's a known one in JDBC-adjacent tests),
      say so explicitly rather than letting a passing run imply zero
      failures.
- [ ] **Lint**, if the change touches renderer code: `cd src && npm run
      lint`.
- [ ] **Live verification**, if the change touches renderer/UI/main-process
      behavior a unit test can't observe — use the `run` skill
      (`.claude/skills/run/`) rather than skipping this because "no
      automation harness exists." One does now.
- [ ] **Pushdown parity**, if the change touches a tool's execution/config —
      use the `pushdown-parity` skill (`.claude/skills/pushdown-parity/`)
      before assuming a fix that works locally is actually done.
- [ ] **Ticket file updated**: `Files Modified`, `Testing`, `Result`
      sections filled in with what actually happened, not a restatement of
      the plan. Move `tickets/open/NNNN-*.md` → `tickets/closed/` and fill
      in `## Closed` with today's date, once genuinely done — not before.
- [ ] **`ticket_memory.md` appended** (never edited in place for past
      entries — append-only) with a real summary: what was found, what was
      fixed, what was explicitly *not* fixed or verified and why.
- [ ] **`project_memory.md` updated** if this changes Active Priorities,
      surfaces a new gotcha worth remembering, or resolves/creates Technical
      Debt or Known Issues.
- [ ] **`CHANGELOG.md`** — new entry under the current version heading (or a
      new version heading — check `version.txt` for the current value and
      whether this change warrants a bump; recent entries in
      `CHANGELOG.md` show the expected `### Added`/`### Changed`/`### Fixed`
      grouping).
- [ ] **`version.txt` bumped**, if this is user-facing (matches the
      CHANGELOG entry).
- [ ] **README updated**, if this changes setup steps, scripts, or
      user-facing behavior documented there.
- [ ] **No dead code left behind**: unused imports, an abandoned first
      approach, a debug `console.log` added while investigating.
- [ ] **Branch verified**: confirm current branch is `feature/TICKET-####` or 
      `bugfix/TICKET-####`, NOT `main`. Run `git branch --show-current` — if 
      it returns `main`, stop and create the proper ticket branch first.
- [ ] **Commit message format**: `[TICKET-####] Short description` — verify
      the ticket number in the message matches the actual ticket file,
      especially after any renumbering (see the `new-ticket` skill).
- [ ] **`/log-cost`**, if token-cost tracking is in use for this ticket —
      separate step, only updates the ticket's own `## Token Usage` table,
      never commits.

## If any item fails

Per CLAUDE.md: **do not commit.** Fix the gap first — a partially-satisfied
checklist is a reason to keep working, not a reason to note the gap in the
commit message and move on. If an item is genuinely inapplicable (e.g. no
UI touched, so no live verification needed), that's fine — but it should be
a deliberate judgment call you could explain if asked, not a silent skip.
