# TICKET-0120 — Guided project-setup interview on new project

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-03

---

## Description

When a project is created through `+` → `✨ New`, the first Claude agent
opened for that project should automatically start a guided setup interview
(`/project-setup`): grill the user about what the project is and its
requirements, play back a summary for agreement, propose a tech stack for
confirmation or adjustment, then rewrite the scaffold's own `.md` files so
they describe the real project instead of the ACE template.

The trigger is one-shot per project and Claude-only.

---

## Reason

The bundled scaffold (TICKET-0096) ships generic template docs
(`AGENTS.md`, `.claude/project_config.md`, `docs/agents/*`, `README.md`)
and two stale prompt files (`.claude/prompts/project_init.md`,
`project_questionnaire.md`) that nothing ever runs. New projects start with
placeholder identity and no captured requirements. A guided interview at
creation time turns the "template config step" into something that actually
executes.

---

## Implementation Plan

* [x] Add self-contained scaffold skill
  `src/main/project-template/.claude/skills/project-setup/SKILL.md`:
  interview (one topic at a time, push back, no code) → structured summary →
  explicit user agreement → tech-stack proposal with rationale → user
  confirm/adjust → rewrite the listed project docs → confirm done.
* [x] Fold the questionnaire fields and the file-update checklist from
  `.claude/prompts/project_init.md` + `project_questionnaire.md` into the
  skill, then delete both prompt files from the scaffold and drop their
  references from scaffold docs.
* [x] `ProjectScaffoldService.createProjectFromScaffold` writes a one-shot
  marker `.claude/.needs-setup` into each new project after the copy.
* [x] Add scaffold `.gitignore` entry for `.claude/.needs-setup`.
* [x] New IPC `projects:consumeSetupFlag(projectPath)` — resolves the path
  against main's project records, deletes the marker if present, returns
  whether it was there. Exposed as `window.ace.consumeProjectSetupFlag`.
* [x] `AgentTerminal.jsx`: once the launch banner lifts, for a
  `provider === 'claude'` agent, consume the flag and, if set, write
  `/project-setup\r` to the PTY. Fires at most once per project.
* [x] Extend `src/tests/project-scaffold.test.js` to assert the marker is
  created.
* [x] `CHANGELOG.md`, `docs/agents/current-state.md`, node map.

---

## Files Modified

- `src/main/project-template/.claude/skills/project-setup/SKILL.md` (new)
- `src/main/project-template/.claude/prompts/project_init.md` (deleted)
- `src/main/project-template/.claude/prompts/project_questionnaire.md` (deleted)
- `src/main/project-template/.claude/PROJECT_SKELETON.md`
- `src/main/project-template/README.md`
- `src/main/project-template/.gitignore`
- `src/main/services/ProjectScaffoldService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/AgentTerminal.jsx`
- `src/tests/project-scaffold.test.js`
- `CHANGELOG.md`
- `docs/agents/current-state.md`
- `docs/node-map.html`

---

## Testing

- `node --test tests/*.test.js` (from `src/`): 69 passed, 1 skipped
  (POSIX-only), 0 failed. `project-scaffold.test.js` now also asserts
  `.claude/.needs-setup` is created.
- `npm run build` (renderer + main): passed.
- Not yet verified live: creating a project via `✨ New` and confirming the
  first Claude agent auto-sends `/project-setup`. Status is Awaiting
  verification once committed.

---

## Result

Creating a project through `✨ New` drops a one-shot `.claude/.needs-setup`
marker. The first Claude `AgentTerminal` for that project consumes it
(`projects:consumeSetupFlag`) once the launch banner lifts and auto-submits
`/project-setup`. The new scaffold skill runs the interview → summary →
tech-stack → doc-rewrite flow itself; the two stale prompt files it replaces
are removed.

---

## Notes

`ponytail:` the auto-send reuses `LAUNCH_BANNER_HIDE_MS` as the "CLI is
ready" signal rather than content-matching the prompt. If a cold start races
the keystroke, the upgrade is a prompt-string match before writing.

Codex agents are out of scope — slash-command skills are a Claude Code
feature. The skill is still runnable by hand in any provider.

---

## Closed

---
