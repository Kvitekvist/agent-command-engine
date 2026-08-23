# Changelog

All notable changes to this template framework should be documented here.

---

## Version 1.3.0 - 2026-08-22

### Added

* **AGENTS.md** - provider-neutral entry point at the repository root: task
  routing table, canonical sources, ticket workflow, definition of done,
  validation commands, and a code-writing ladder (YAGNI, reuse, stdlib,
  native, minimum diff)
* Keyword-aware retrieval - `brain.js` scores an optional per-node
  `keywords` field at weight 2, so conceptual queries reach files whose
  filename does not describe them
* `scripts/build-node-map.js` - committed node-map generator that preserves
  the curated KEYWORDS map and labels ticket nodes with their description,
  plus `build_node_map.bat`/`.sh` wrappers
* Cross-platform script siblings: `setup.sh`, `run.sh`, `build.sh`,
  `clear_cache.sh`, and `run_tests.sh` as the single verification entry point
* `.github/workflows/tests.yml` - CI running `scripts/run_tests.sh`
* `docs/agents/{current-state,architecture-guide,conventions}.md` - the three
  short documents the routing table points at
* Ticket status vocabulary (Open / Awaiting verification / Blocked / Closed)

### Changed

* `.claude/CLAUDE.md` reduced from ~300 lines of prose to a Claude-specific
  pointer at AGENTS.md
* `node-map` and `build-node-map` merged into one skill; `node-map` now
  runs the committed generator in this repository
* `.gitignore` covers `/dist/`, `/src/dist/`, and `.claude/temp_nodedata.json`

### Removed

* FlowGrid installation notes under `docs/` (SECOND_BRAIN, EXPERT_ANALYSIS,
  RESEARCH_SUMMARY, SKILL_RECOMMENDATIONS, SKILLS_IMPLEMENTATION_STATUS) and
  committed session junk (`.claude/temp_nodedata.json`, `.claude/calibration/`)

---

## Version 1.2.0 — 2026-08-06

### Added

* **Second Brain System** - Comprehensive AI project management framework from FlowGrid
* Smart context loading via `context-load` skill (70-80% token cost reduction)
* Safe ticket numbering via `new-ticket` skill (prevents concurrent session collisions)
* Token usage tracking via `log-cost` command
* Memory archival system via `memory-archive` skill
* Enhanced CLAUDE.md with context-load integration
* Framework structure files: PROJECT_RULES.md, PROJECT_SKELETON.md, framework_version.md, project_config.md
* Enhanced memory templates: coding_conventions.md, project_status.md, tech_stack.md
* Memory archive directory structure (`.claude/memory/archive/`)
* Changelog append skill for automated changelog updates
* Definition-of-done skill for commit verification
* Helper scripts: `next_ticket.bat` and `next_ticket.js`
* Comprehensive `docs/SECOND_BRAIN.md` documentation

### Changed

* Ticket template now includes Token Usage tracking section
* Ticket naming convention documented (NNNN-Short Title.md format)
* All closed tickets renamed to new convention
* Enhanced "Every Session" workflow in CLAUDE.md to use context-load skill

---

## Version 1.1.0 — 2026-07-06

### Added

* Ticket decomposition system for managing large requests
* Parent/child ticket relationships in ticket template
* Dependency tracking between tickets
* `.claude/prompts/decomposition.md` - comprehensive decomposition workflow guide
* Decomposition guidance in CLAUDE.md and PROJECT_RULES.md

### Changed

* Enhanced ticket template with Parent Ticket, Child Tickets, and Dependencies fields
* Updated feature workflow in CLAUDE.md to include scope assessment and decomposition

---

## Version 1.0.0 — 2026-07-05

Initial template framework creation.

### Added

* `.claude/` AI operating instructions, rules, and framework version tracking.
* Persistent memory system (`.claude/memory/`): architecture, coding conventions,
  project memory, project status, tech stack, ticket memory.
* Workflow prompts (`.claude/prompts/`): feature, bugfix, refactor, release,
  project initialization, and project questionnaire.
* Reusable templates (`.claude/templates/`): README, changelog, ticket.
* Ticket system skeleton (`tickets/open`, `tickets/closed`, `tickets/archived`, `tickets/TEMPLATE.md`).
* Helper scripts (`scripts/`): setup, build, run, git commit, clear cache, release.
* Standard project skeleton (`src/`, `tests/`, `docs/`, `build/`, `releases/`, `assets/`).
* Root documentation: README, CHANGELOG, LICENSE, `.gitignore`, `version.txt`.

### Changed

*

### Fixed

*

### Removed

*
