---
name: project-setup
description: One-time guided setup for a project freshly created from the ACE scaffold. Interviews the user about what the project is and its requirements, agrees a summary, proposes and confirms a tech stack, then rewrites the scaffold's own docs to describe the real project. ACE auto-runs this as the first Claude agent's opening command in a new project; it can also be invoked by hand with /project-setup. Triggers on "set up this project", "configure the template", "project setup".
version: 1.0.0
---

# Guided project setup

This project was just copied from the ACE template. Every identity file in it
still describes the template, not this project. Your job is to fix that
through a short interview, not to start building features.

Do not write application code during this skill. Do not create feature
tickets. The only files you touch are the ones in the **Apply** section.

Work the four phases in order. Do not skip ahead.

---

## Phase 1 — Interview

Switch into interviewer mode. Ask about **one topic at a time**, start with
the highest-impact unknowns, and do not move on until a topic is settled.
Push back when an answer is vague, risky, or contradicts an earlier one.
Never assume — if something is ambiguous, ask.

Cover every field below. Skip a question only if the user has already
answered it.

**Product**
- Project name
- One-line description
- Main purpose / problem it solves
- Target users
- Expected size (throwaway, small tool, long-lived product)
- Expected contributors (solo, small team, open source)

**Technical**
- Programming language(s)
- Framework(s)
- Runtime / target operating system(s)
- Build system and package manager
- Database, if any
- External APIs or services it depends on
- Deployment target (desktop binary, container, static site, library, …)
- Does it need a distributable executable or installer?

**Workflow**
- Git remote URL, if one exists; public or private
- Branch strategy (feature branches, trunk, …)
- Must every change go through a ticket?
- Run the build automatically after changes?
- Push commits automatically?
- Cut GitHub releases on version bumps?

**Quality**
- Test framework and whether tests are required to merge
- Formatter and linter
- CI/CD system, if any

Ask "anything else I should know?" before closing the interview.

---

## Phase 2 — Summary and agreement

Play back what you understood as a structured summary: product in a
sentence, then the technical and workflow decisions as short bullet lists.
Name any decision you are inferring rather than quoting.

Ask the user to confirm. If they correct anything, fold it in and replay the
changed part. Do not continue until they explicitly agree.

---

## Phase 3 — Tech stack

If the interview already pinned the stack, restate it and ask for a yes.

Otherwise propose one: language, framework, build tool, package manager,
test framework, formatter/linter, and (if relevant) database and deployment
target, each with a one-line reason tied to something the user said. Offer a
lighter and a heavier alternative for any choice that is a real fork.

The user confirms or adjusts. Lock the stack before Phase 4.

---

## Phase 4 — Apply

Rewrite the project's own files so they describe *this* project. Preserve
each file's existing structure and headings — replace the template content,
do not append. Never invent facts the interview did not establish; leave a
`TODO:` marker instead.

- **`.claude/project_config.md`** — every field: `project_name`, `language`,
  `framework`, `build_tool`, `git_provider`, `build_executable`,
  `auto_push`, `ticket_system`, `branch_strategy`, `tests_required`,
  `release_method`.
- **`AGENTS.md`** — project name, the one-line description at the top, the
  Canonical sources table (version file, test/build commands), and the
  Validation section so its commands match the chosen tooling.
- **`.claude/CLAUDE.md`** — project name references only; keep the
  Claude-specific structure.
- **`README.md`** — replace the template's "what this is / how it works"
  with a real description, install steps, and run/build/test commands for
  the chosen stack. Drop the "Manual Setup" section.
- **`docs/agents/current-state.md`** — version (start at `0.1.0`), the
  active priority ("initial build"), and known constraints from the
  interview.
- **`docs/agents/architecture-guide.md`** — a first-pass system boundary
  and data-flow description, or a `TODO:` stub if the design is not settled.
- **`docs/agents/conventions.md`** — coding and test conventions for the
  chosen language, formatter, and linter.
- **`.claude/memory/tech_stack.md`**, **`project_memory.md`**,
  **`project_status.md`**, **`architecture.md`** — record the confirmed
  stack, purpose, and current status.
- **`CHANGELOG.md`** — a single `## [0.1.0]` entry: "Project initialised
  from ACE template."
- **`version.txt`** and any `package.json` / project manifest — set the
  name and version `0.1.0`.
- **`.claude/PROJECT_SKELETON.md`** — prune folders and files that do not
  apply to the chosen stack.

Then:
- Initialise git if there is no repo and the user wants one; connect and
  verify the remote if they gave a URL. Do not push unless they ask.
- Delete `.claude/.needs-setup` if it is still present.
- Run `node scripts/build-node-map.js` to regenerate `docs/node-map.html`.

Finish with a short recap: project name, stack, build/test commands, git
status, version, and the first task the user should request. Then stop and
wait for that request.
