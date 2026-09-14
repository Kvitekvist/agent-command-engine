# TICKET-0132 — Bundle third-party skills directly; add a Project Skills button

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-13

---

## Description

1. Stop live-cloning the three third-party skills (`calibrate-enhanced`,
   `gauntlet-loop`, `token-analytics`) from their authors' GitHub repos on
   first launch, and stop the mandatory consent dialog that gated it
   (decline used to quit ACE before any window opened). All three are
   already bundled in `src/main/project-template/.claude/skills/` under
   permissive licenses (MIT, MIT, CC-BY-4.0) that allow shipping them
   directly -- ship those bundled copies as the only copy.
2. Add a "🧩 Skills" button to the Agents tab's top bar that opens a
   read-only list of every skill available in the active project
   (name + description parsed from each `SKILL.md`'s frontmatter).

---

## Reason

User: avoid the first-run GitHub consent popup, given the skills can be
bundled legally; and wanted an easy way to see which skills a project has.

---

## Implementation Plan

AUDIT-31: regenerate the index, retain titled H1 topics for numbered-only
ticket filenames and add existing curated search keywords for Notes/Skills
components. Keep queries file-only; no content search or new indexing service.

### Audit continuation, 2026-09-14

Keep bundled skills and credits, remove superseded download instructions, show skills per provider, regenerate node map after structural changes.

* [x] Deleted `SkillSetupService.js` (clone + consent-dialog gate) and its
      call in `src/main/index.js`.
* [x] `ProjectScaffoldService.ensureBundledSkills(projectPath, scaffoldDir)`
      simplified to a single source (the bundled template) -- dropped the
      `cacheDir` parameter and the cache-vs-template precedence logic that
      existed only to prefer a live-downloaded copy.
* [x] `THIRD_PARTY_SKILLS.md` (repo root and `project-template/.claude/`)
      reworded from "downloaded on first run" to "bundled directly", commit
      hashes dropped since nothing is fetched anymore.
* [x] `skill-sources.json`'s `_comment` updated to describe it as a
      provenance record only, not something read at runtime.
* [x] New `ProjectSkillsPanel.jsx` + `utils/skills.mjs`
      (`parseSkillFrontmatter`): reads `.claude/skills/*/SKILL.md` for the
      active project via the existing `fs.readDir`/`readFile` IPC (no new
      IPC surface) and lists name + description.
* [x] "🧩 Skills" button wired into `AgentView.jsx`'s top bar, next to the
      sound-mute toggle.
* [x] Unit test for `parseSkillFrontmatter`; updated the
      `ensureBundledSkills` test for the simplified single-source signature.

---

## Files Modified

Audit continuation: ProjectScaffoldService.js, ProjectSkillsPanel.jsx, README.md, CHANGELOG.md, docs/agents notes/release/audit docs and node-map.html.

* `src/main/services/SkillSetupService.js` (deleted)
* `src/main/index.js`
* `src/main/services/ProjectScaffoldService.js`
* `src/main/ipc/handlers.js`
* `src/main/project-template/.claude/skill-sources.json`
* `src/main/project-template/.claude/THIRD_PARTY_SKILLS.md` (new)
* `.claude/THIRD_PARTY_SKILLS.md`
* `src/renderer/components/ProjectSkillsPanel.jsx` (new)
* `src/renderer/utils/skills.mjs` (new)
* `src/renderer/views/AgentView.jsx`
* `src/tests/project-scaffold.test.js`
* `src/tests/skills.test.js` (new)

---

## Testing

Audit continuation: Bundled-skill guard tests and Windows diagnostic package pass. Fresh native launch and externally-scaffolded project skill actions still require review. TICKET-0127's mandatory gate is superseded.

* `npm test`
* `npm run build:renderer`, `npm run build:main`

---

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.



---

## Notes

Re-syncing a bundled third-party skill from upstream in the future is now a
manual step (clone the repo named in `skill-sources.json`, copy its skill
files into `project-template/.claude/skills/<name>/`) rather than automatic.

---

## Closed
