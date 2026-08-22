---
name: build-node-map
description: Rebuild ACE's second brain - regenerates docs/node-map.html from the current repository so brain.js retrieval and the browsable dashboard stay accurate. Use when the user asks to rebuild/refresh/regenerate the node map or second brain, after adding services, tickets, docs or reorganising directories, or when brain.js results look stale or miss a file that exists. In this repository use this skill instead of /node-map.
---

# build-node-map

Regenerates `docs/node-map.html`, the index that
`.claude/skills/node-map/assets/brain.js` queries and that opens in a browser
as the node graph.

## Use this instead of `/node-map` in this repository

The generic `node-map` skill scans the project live and rebuilds the data by
hand each run. In ACE that is the wrong path: a live rescan silently drops two
things `scripts/build-node-map.js` holds.

1. **The curated `KEYWORDS` map.** Search terms for files whose name describes
   their form rather than their content. Nothing here is called
   `definition-of-done.md` - that rule lives in `AGENTS.md`, which carries
   `"commit message format definition of done ticket workflow"` so the query
   lands.
2. **Ticket-description labelling.** Ticket nodes are labelled
   `TICKET-0077 separate terminal lifecycle hooks`, not `TICKET-0077.md`.
   Labels carry 3x weight, and a bare ticket number is unmatchable by topic.

Reach for `/node-map` only when generating a map for a *different* project
that has no generator of its own.

## Run it

```bash
node scripts/build-node-map.js
```

Or the helper scripts, which additionally check that Node is on PATH and that
the file was actually written:

```
scripts\build_node_map.bat     # Windows
bash scripts/build_node_map.sh # macOS / Linux
```

The generator is dependency-free and reads only file metadata - name, size,
modified date - plus each ticket's Description line. It never reads source
file contents.

## When to run it

- After adding, removing, or renaming services, components, scripts, or docs.
- After a wave of new tickets, or after moving tickets between `open/` and
  `closed/`.
- When `brain.js` misses a file you know exists, or its results name paths
  that have since moved.

Check the `generated` timestamp inside `docs/node-map.html` if you are unsure
how stale it is.

## After running

Report the category and node counts the script prints, and confirm the map
with a query that exercises whatever changed:

```bash
node .claude/skills/node-map/assets/brain.js "<something you just added>"
```

Commit `docs/node-map.html` with the change that made it stale, not as a
separate housekeeping commit - a map that lags its repository is the failure
mode this skill exists to prevent.

## Adding keywords

When you add a document whose filename will not match how someone would ask
for it, add a `KEYWORDS` entry in `scripts/build-node-map.js` keyed by its
repository-relative path:

```js
"docs/agents/conventions.md": "coding style rules commonjs esm testing conventions",
```

Keep entries short and specific. A long keyword list on a common file makes it
win queries it should not - keywords score above a path match but below a
filename match, and that ordering only holds if the lists stay lean.

## Do not hand-edit the output

`docs/node-map.html` is generated. Edit `scripts/build-node-map.js` (data and
keywords) or `.claude/skills/node-map/assets/template.html` (the rendering
engine, shared with every other project using this skill) and regenerate.
