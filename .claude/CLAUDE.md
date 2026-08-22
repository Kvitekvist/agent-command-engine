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
| `skills/build-node-map/` | Rebuilds `docs/node-map.html` from this repository. Use `/build-node-map` here — **not** `/node-map`. |
| `skills/node-map/` | The shared second-brain engine: `brain.js` retrieval and the dashboard template. Its `/node-map` skill does a live rescan, which drops ACE's curated keywords and ticket labels. |
| `memory/` | Append-only historical context. Search it by ticket number or feature term; never read it end to end. `MEMORY.md` indexes it. |
| `prompts/`, `templates/` | Bootstrap-framework scaffolding for new work items. |
| `project_config.md` | Project metadata for the bootstrap framework. |
| `PROJECT_RULES.md`, `PROJECT_SKELETON.md`, `framework_version.md` | Bootstrap-framework provenance. Superseded by `AGENTS.md` where they disagree. |
| `tickets/` | Legacy copies. Not a work queue — use `tickets/` at the repository root. |

## Regenerating the node map

Invoke `/build-node-map`, or run `node scripts/build-node-map.js` directly,
after structural changes (new services, a wave of new tickets, a directory
reorganisation). It rewrites `docs/node-map.html` in place; `brain.js` reads
that file directly, so there is no separate index to keep in sync.

Use that skill, **not** a live `/node-map` rescan. See
`.claude/skills/build-node-map/SKILL.md` for why, and for how to add a
`KEYWORDS` entry when a document's filename won't match how someone would ask
for it.
