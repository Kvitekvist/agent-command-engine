# Claude instructions for ACE

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

## What lives under `.claude/`

| Path | Purpose |
| --- | --- |
| `skills/node-map/` | The second-brain skill: `brain.js` retrieval and the dashboard engine. Invoke `/node-map` to regenerate `docs/node-map.html`. |
| `memory/` | Append-only historical context. Search it by ticket number or feature term; never read it end to end. `MEMORY.md` indexes it. |
| `prompts/`, `templates/` | Bootstrap-framework scaffolding for new work items. |
| `project_config.md` | Project metadata for the bootstrap framework. |
| `PROJECT_RULES.md`, `PROJECT_SKELETON.md`, `framework_version.md` | Bootstrap-framework provenance. Superseded by `AGENTS.md` where they disagree. |
| `tickets/` | Legacy copies. Not a work queue — use `tickets/` at the repository root. |

## Regenerating the node map

Run `node scripts/build-node-map.js` after structural changes (new services, a
wave of new tickets, a directory reorganisation). It rewrites
`docs/node-map.html` in place; `brain.js` reads that file directly, so there
is no separate index to keep in sync.

Use the script, **not** a live `/node-map` rescan. The script holds two things
a rescan would silently drop: the curated `KEYWORDS` map (search terms for
files whose names don't say what they answer, like the commit format living in
`AGENTS.md`) and the ticket-label logic that folds each ticket's description
into its node label so `brain.js` can match tickets by topic.

Add a `KEYWORDS` entry when you add a document whose filename won't match how
someone would ask for it.
