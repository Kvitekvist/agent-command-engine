# Claude instructions

**Read [`AGENTS.md`](../AGENTS.md) at the repository root first.** It is the
provider-neutral entry point and holds the operating rules for this project:
retrieval protocol, task routing, ticket workflow, commit format, definition
of done, and validation commands. Everything below is Claude-specific only.

Do not duplicate rules here. If a rule applies to any agent, it belongs in
`AGENTS.md`.

## Retrieval

Before an open-ended Grep/Glob sweep for a specific file or document:

```bash
node .claude/skills/node-map/assets/brain.js "<question>"
```

Read the top-ranked result before searching further. See `AGENTS.md`'s
"Finding things" section for exit codes and when to fall back.

For loading session context (memory files, open tickets, current milestone),
use the `context-load` skill rather than reading the memory files in full -
`.claude/memory/ticket_memory.md` is grep-only by default.

## Skills

| Skill | Use for |
| --- | --- |
| `context-load` | Loading project context at the start of a session |
| `new-ticket` | Creating a ticket with a collision-safe number |
| `changelog-append` | Adding a `CHANGELOG.md` entry |
| `definition-of-done` | The pre-commit verification pass |
| `memory-archive` | Trimming memory files that have grown too large |
| `code-review-ai`, `security-scan`, `test-generator` | Review, scanning, test scaffolding |
| `calibrate-enhanced`, `token-analytics`, `gauntlet-loop` | Framework calibration and cost analysis |
| `node-map` | Rebuilding `docs/node-map.html` (it runs `scripts/build-node-map.js`) |

`/log-cost` records token usage on the active ticket. Run it before closing a
ticket so the Token Usage table is populated.

## Regenerating the node map

Run `node scripts/build-node-map.js` (or invoke `/node-map`, which does the
same thing here) after structural changes - new modules, a wave of new
tickets, a directory reorganisation. It rewrites `docs/node-map.html` in
place; `brain.js` reads that file directly, so there is no separate index to
keep in sync.

Never rebuild the data by hand in this repository: a live rescan drops the
curated `KEYWORDS` map and the ticket-description labels the generator adds.
See `.claude/skills/node-map/SKILL.md`.

## What lives under `.claude/`

| Path | Purpose |
| --- | --- |
| `skills/` | Skill definitions (table above) |
| `memory/` | Long-term context. Search it; never read `ticket_memory.md` end to end. |
| `prompts/`, `templates/` | Scaffolding for new work items and releases |
| `project_config.md` | Project metadata (stack, build tool, workflow flags) |
| `PROJECT_RULES.md`, `PROJECT_SKELETON.md`, `framework_version.md` | Framework provenance. Superseded by `AGENTS.md` where they disagree. |
