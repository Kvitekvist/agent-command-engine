# TICKET-0106 — Push update quick action: ticket → branch → PR

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-02

---

## Description

The agent terminal's "Commit & Push" quick action ran a dumb
`git add -A` + commit + push straight from the main process (`git:commitAndPush`).
It committed to whatever branch was checked out (often `main`), used a fixed
"Quick commit from ACE" message, staged everything indiscriminately, and left
no ticket or PR behind.

Replace it with **"Push update"**: a quick action that hands the current
working-tree change to the agent as `/push-update`, which files one ticket,
cuts one `feature/`|`bugfix/` branch, makes one local commit, and opens one
PR with a written-up title and description. One fix = one branch = one PR.

---

## Reason

Every change in this repo needs a ticket and belongs on its own branch/PR
(AGENTS.md). The old button actively worked against that: no ticket, no
branch, `main` committed to directly, unrelated working-tree changes swept
into one commit. TICKET-0103 already anticipated this workflow by name.

---

## Implementation Plan

* [x] Rename the button "⬆️ Commit & Push" → "⬆️ Push update"; on click it
      writes `/push-update` to the terminal (same pattern as the Calibrate
      button) instead of calling an IPC handler.
* [x] Remove the dead `git:commitAndPush` IPC handler, its `preload.js`
      binding, and the renderer's `commitPushStatus` feedback state.
* [x] Move the `shell:false` explanatory comment onto `git:pull` and fix the
      stale `prereqs:check` reference to it.
* [x] Add `.claude/skills/push-update/SKILL.md` sequencing AGENTS.md's ticket
      workflow / git rules / definition of done: understand the diff, pick the
      next ticket number, create the ticket from the template, branch, stage
      explicitly (never `git add -A`), commit locally, push, `gh pr create`
      with a structured body, report the PR URL.
* [x] Confirm every quick-action button carries a `title` tooltip; reword the
      Push update one to describe the new flow.
* [x] CHANGELOG updated; node map regenerated for the new skill.

---

## Files Modified

- `src/renderer/components/AgentTerminal.jsx` — button rename + behaviour,
  removed `commitPushStatus` state and its `OperationFeedback` row
- `src/main/preload.js` — dropped `git.commitAndPush` binding
- `src/main/ipc/handlers.js` — removed `git:commitAndPush` handler, moved its
  `shell:false` note to `git:pull`, fixed `prereqs:check` comment
- `.claude/skills/push-update/SKILL.md` — new skill
- `CHANGELOG.md`, `docs/node-map.html`

---

## Testing

- `npm test` from `src/`
- `npm run build` from `src/`
- Manual: launch an agent, make a small edit in its project, click
  "Push update", confirm a ticket + branch + local commit + PR are created
  for just that change and the button tooltip reads correctly.

---

## Result

Awaiting live manual check of the button → skill flow.

---

## Notes

The skill is Claude-specific (`/push-update`). For a Codex session the button
still types the command; Codex will not have the skill. Matches the existing
unguarded Calibrate button — revisit if Codex gets an equivalent.

---

## Closed

YYYY-MM-DD
