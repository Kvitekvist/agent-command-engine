---
name: push-update
description: Turn the current working-tree change into a reviewable update - one ticket, one branch, one local commit, one PR. Invoked by the "Push update" quick-action button in the agent terminal, or by running /push-update. Use when the user has a finished change and wants it filed and raised as a pull request the ACE way.
---

# push-update

Takes whatever is uncommitted in the project right now and turns it into a
single reviewable unit: a ticket, a branch, a local commit, and a pull
request with a written-up title and description. One fix = one branch = one
PR. Nothing is force-pushed and `main` is never committed to directly.

Read `AGENTS.md` (repo root) first — its **Ticket workflow**, **Git**, and
**Definition of done** sections are authoritative and this skill only
sequences them.

## When NOT to just run it

- **Nothing staged or unstaged** (`git status --porcelain` empty): stop and
  say so.
- **The working tree mixes unrelated changes**: identify the one coherent
  change the user means (ask if genuinely ambiguous). Only that change's
  files go on the branch — leave the rest in the working tree untouched.
  Never `git add -A` / `git add .` (see [[ace-parallel-agents-in-tree]]).
- **Already on a `feature/` or `bugfix/` branch for this work**: skip branch
  creation, just commit and open/update the PR.

## Steps

1. **Understand the change.** `git status` + `git diff` (and `git diff
   --staged`). Decide: bug fix or feature? Write a short imperative title
   (~6 words) and a slug (`kebab-case`).

2. **Pick the ticket number.** Highest `TICKET-####` across `tickets/open/`
   and `tickets/closed/` **and** any referenced in ticket bodies, plus one.
   `grep -rhoE 'TICKET-[0-9]{4}' tickets/ | sort -u | tail`.

3. **Create the ticket.** Copy `tickets/TEMPLATE.md` to
   `tickets/open/TICKET-####-[bug|feature]-[slug].md`. Fill H1
   (`# TICKET-#### — Short title`), Status `Awaiting verification`, Type,
   Priority, Created (today), Description, Reason, a checked Implementation
   Plan reflecting what was actually done, Files Modified, Testing, Result.
   A ticket with no `# TICKET` H1 is invisible to the queue.

4. **Branch.** From an up-to-date base (`git fetch`; branch off
   `origin/main` unless the user is working from `develop`):
   `git switch -c feature/TICKET-####-slug` (or `bugfix/…`).

5. **Commit locally.** Stage the change's files explicitly plus the new
   ticket file. Message:

   ```
   [TICKET-####] Short description

   <1–3 sentences: what changed and why>

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

   Use whatever additional commit trailers your harness mandates. Do not
   push yet if any Definition-of-done check (build, tests, CHANGELOG for
   user-facing changes, version bump if releasing) is unmet — fix first.

6. **Push the branch.** `git push -u origin feature/TICKET-####-slug`.

7. **Open the PR.** `gh pr create --base main --head <branch>` with:
   - **Title:** `[TICKET-####] Short description`
   - **Body:**
     ```
     ## Summary
     <what and why, 2–4 sentences>

     ## Changes
     - <file / area>: <what changed>

     ## Testing
     <commands run + result, or why not>

     Ticket: TICKET-####
     ```
   Append the PR footer your harness mandates.

8. **Report** the PR URL and the ticket path. Leave the branch checked out.

## Notes

- No GitHub remote / `gh` not authed: do steps 1–5, then tell the user the
  branch and commit are ready and the PR needs `gh auth login` or a manual
  push.
- Keep the ticket, commit, and PR describing the **same** single change. If
  mid-run you find the diff is really two changes, do the first one fully
  and tell the user to re-run for the second.
