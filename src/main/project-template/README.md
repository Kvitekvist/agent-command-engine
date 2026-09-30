# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

The stack, build steps and run commands are not decided yet. They are agreed
in the first agent session (`/project-setup`), which rewrites this README.

---

## How It Works

* **`AGENTS.md`** — the entry point every coding agent reads first, whichever
  tool it is: task routing, ticket workflow, definition of done, git rules,
  and how to write code here.
* **`.claude/CLAUDE.md`** — the Claude-specific layer on top of `AGENTS.md`
  (skills, `/log-cost`, node-map regeneration). Rules that apply to any agent
  live in `AGENTS.md`, not here.
* **`docs/agents/`** — current state, architecture guide, and conventions: the
  three documents the routing table points at.
* **`docs/node-map.html`** — the project's second brain. Query it with
  `node .claude/skills/node-map/assets/brain.js "<question>"` instead of an
  open-ended search; rebuild it with `node scripts/build-node-map.js`.
* **`.claude/PROJECT_RULES.md`** — the definition of done for any ticket.
* **`.claude/PROJECT_SKELETON.md`** — the canonical folder/file layout for any
  project built from this template.
* **`.claude/memory/`** — persistent, continuously-updated project memory
  (architecture, tech stack, coding conventions, project status,
  ticket history). Read at the start of every session.
* **`.claude/prompts/`** — step-by-step workflows for features, bug fixes,
  refactors, and releases.
* **`.claude/templates/`** — reusable templates for README, CHANGELOG, and
  ticket files.
* **`tickets/`** — every feature and bug fix is tracked as a ticket,
  organized by category (`features/`, `bugs/`, `documentation/`,
  `infrastructure/`, `research/`) in `open/`, `closed/`, and `archived/`
  directories. See `docs/TICKET_CATEGORIES.md` for the category system.
* **`scripts/`** — helper scripts (`setup`, `build`, `run`, `clear_cache`,
  `run_tests`, `build_node_map`, `git_commit`, `release`), customized per
  project's stack. `.bat` and `.sh` siblings, so the template is not
  Windows-only; `scripts/run_tests.sh` is the single entry point CI uses.

---

## Project Structure

See `.claude/PROJECT_SKELETON.md` for the full, authoritative layout.

---

## Development Workflow

* Every feature or bug fix requires a ticket before code is written.
* Documentation (README, architecture, changelog) is updated
  alongside the code change, not after the fact.
* Commits follow the format `[TICKET-####] Short description`.
* Memory files are the source of truth for project context across sessions.

---

## License

No license has been chosen yet — see `LICENSE`.
