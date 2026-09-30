# TICKET-0165: Clean new-project template and seed memory

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-29

---

## Description

Generate a neutral project template and seed its identity and memory from the name and description supplied by the new-project wizard.

## Reason

The bundled template contains historical completed tickets, an unrelated open backport ticket, a historical commit, version 1.2.0 and another user's preferences. Copying it unchanged makes these appear to be facts about a new project.

## Implementation Plan

* [x] Audit bundled identity, memory, tickets and docs. Remove inherited project history and preferences while preserving framework attribution and third-party licenses.

* [x] Initialize project name, purpose, initial priority and version consistently. Leave unknown stack and architectural decisions explicitly unset.

* [x] Keep scaffold copying and initial memory writes in ProjectScaffoldService. Treat the description as project data, not permission to execute commands.

* [x] Keep provider-neutral first-prompt memory guidance aligned with TICKET-0120 and regenerate the bundled node map after template cleanup.

* [x] Extend scaffold tests to use the actual bundled template and assert neutral history, seeded identity, intact required files and no overwrites of existing folders.

## Files Modified

Template (`src/main/project-template/`):
- `version.txt` 1.3.0 -> 0.1.0; `CHANGELOG.md` replaced with an Unreleased + `[0.1.0] - {{CREATED_DATE}}` project changelog (framework history stays in `.claude/framework_version.md`).
- `.claude/memory/ticket_memory.md`: template TICKET-0001..0005 history removed.
- `.claude/memory/project_status.md`: version 0.1.0, milestone "Project setup", no completed tickets, no inherited commit.
- `.claude/memory/project_memory.md`: vision is `{{PROJECT_DESCRIPTION}}`; another user's "User Work Style" and phased-implementation example removed; stack and architecture listed as open questions.
- `.claude/project_config.md`, `docs/agents/current-state.md`, `AGENTS.md`, `README.md`: name/description placeholders; README drops the GitHub-template quick start, "What's New", and repository-admin sections.
- `.claude/skills/project-setup/SKILL.md` (and ACE's own mirror in `.claude/skills/`): name and description are pre-filled; confirm rather than re-ask.

Service and tests:
- `src/main/services/ProjectScaffoldService.js`: `seedProjectIdentity` fills `{{PROJECT_NAME}}`, `{{PROJECT_DESCRIPTION}}`, `{{PROJECT_SUMMARY}}` (first line, max 120 chars), `{{CREATED_DATE}}` in seven files in one regex pass, after the copy and before the marker. CRLF normalised; empty description becomes "Not described yet."
- `src/tests/project-scaffold.test.js`: now runs against the real bundled template.

## Testing

- `tests/project-scaffold.test.js` (real template): required files present, `.ace-gitkeep` restored, seeded README/AGENTS/config/memory/current-state/changelog, no placeholder left anywhere in the project, a multiline description with `$&`, `{{PROJECT_NAME}}` and HTML copied literally, version 0.1.0, no ticket history, no open tickets, an existing folder untouched, blank description placeholder, failed copy removes the folder.
- The inherited ticket and the two distribution docs were deleted (`git rm`, run by the user); the bundled node map was regenerated without them.
- `npm test` and `npm run build`: see the commit run.

## Result

Implemented and committed. Needs one real project created through the wizard and a first `/project-setup` run to confirm the seeded files read well.

## Notes

Deleted from the template: `tickets/open/infrastructure/0027-Backport ACE improvements.md`, `docs/DISTRIBUTION.md`, `docs/QUICK_START.md`. `docs/node-map.html` regenerated.

The `/project-setup` skill now confirms the pre-filled name and description; recording requirements after the first prompt for Claude and Codex stays with TICKET-0120.

Coordinates with TICKET-0164 for input and TICKET-0120 for subsequent agent updates. Do not overwrite memory in projects that already exist.

2026-09-30, v0.1.43: a Windows checkout (`core.autocrlf=true`) ships the
template with CRLF. Seeding inserted the description with LF, so seeded files
mixed line endings, and the tests (written against the LF working tree)
failed on the clean checkout the release build uses. Seeding now uses each
file's own line ending; the tests normalise line endings and assert no seeded
file mixes them (fails on the old code against a CRLF checkout).

---

## Closed

Pending.

