# AI Project Bootstrap Template

## Overview

This is a copy-pasteable starting point for new AI-assisted software projects.
It provides a standardized structure, workflow, and long-term memory system so
that any project built from it stays maintainable over months of AI-assisted
development, rather than accumulating undocumented, untracked changes.

---

## Quick Start

### Creating a New Project from This Template

**Prerequisites**: Git and [GitHub CLI](https://cli.github.com/) installed

```bash
# Step 1: Create from template
gh repo create my-new-project --template Kvitekvist/claude_project_framework --private --clone
cd my-new-project

# Step 2: Initialize your project
.\scripts\init_project.bat

# Step 3: Start building!
```

The initialization script will prompt you for project details and customize the template
for your specific language, framework, and workflow.

**See [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) for complete setup instructions.**

---

## Manual Setup (Alternative)

If you prefer to set up manually:

1. Copy this entire folder to a new location and rename it for the new project.
2. Open the project in Claude Code.
3. Answer `.claude/prompts/project_questionnaire.md` (project name, stack,
   git details, quality requirements, etc.).
4. Let Claude follow `.claude/prompts/project_init.md` to fill in
   `.claude/project_config.md`, the memory files, scripts, and root
   documentation for the new project.
5. Start requesting features and bug fixes — every change is tracked through
   the ticket system described below.

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
  refactors, releases, and initializing a brand-new project.
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

## Version

Framework Version: 1.1.0

See `.claude/framework_version.md` for framework-level version history and
migration rules.

### What's New in 1.1.0

* **Ticket Decomposition** - Automatically break large requests into parent/child
  tickets with dependency tracking
* **Enhanced Ticket Template** - Support for parent tickets, child tickets, and
  dependencies
* **Decomposition Workflow** - Comprehensive guide in
  `.claude/prompts/decomposition.md` for managing complex multi-part features

---

## For Repository Administrators

### Enable GitHub Template Feature

To make this repository usable as a template:

1. Go to **Settings** in this GitHub repository
2. Under **General**, check ✅ **Template repository**
3. Save changes

Users can then create new projects using the Quick Start commands above.

See [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) for administration details.

---

## License

No license has been chosen yet — see `LICENSE`.
