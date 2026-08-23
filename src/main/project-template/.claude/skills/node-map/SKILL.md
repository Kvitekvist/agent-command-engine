---
name: node-map
description: Build or rebuild the project's second brain - an interactive, self-contained HTML node-network dashboard (docs/node-map.html) plus the brain.js retrieval script that finds files by keyword score instead of an open-ended Grep/Glob sweep. Use when the user asks to rebuild/refresh/regenerate the node map or second brain, after adding modules, tickets or docs, when brain.js results look stale, or to visualize/map/chart the project structure as a node graph.
---

# node-map

Produces one self-contained HTML file that renders the target project as a radial
node graph: a central "brain" node (CLAUDE.md, or the project itself), a ring of
category nodes (one per conventional folder that actually exists), and a cluster
of file nodes around each category. No build step, no dependencies - the file
opens directly in any browser. `assets/brain.js` reads that same file to answer
"where is X" without a search sweep.

## In this repository: run the generator

```bash
node scripts/build-node-map.js
```

or `scripts\build_node_map.bat` / `bash scripts/build_node_map.sh`, which also
check that Node is on PATH and that the file was written. **Do not rebuild the
data by hand here.** A live rescan silently drops two things the committed
generator holds:

1. **The curated `KEYWORDS` map** - search terms for files whose name describes
   their form rather than their content. Nothing is called
   `definition-of-done.md`; that rule lives in `AGENTS.md`, which carries
   `"commit message format definition of done ticket workflow"` so the query
   lands. Add an entry, keyed by repository-relative path, when you add a
   document whose filename will not match how someone would ask for it.
2. **Ticket-description labelling** - ticket nodes read
   `TICKET-0012 add the login window`, not `0012-Login window.md`. Labels carry
   3x weight, and a bare ticket number is unmatchable by topic.

Rerun it after adding/renaming modules, scripts or docs, after a wave of new
tickets, after moving tickets between `open/` and `closed/`, or when `brain.js`
misses a file you know exists. Report the counts it prints, confirm with
`node .claude/skills/node-map/assets/brain.js "<something you just added>"`,
and commit `docs/node-map.html` with the change that made it stale - not as a
separate housekeeping commit. The `cats` array at the bottom of the generator
lists the categories; extend it when the project grows real source trees.

`docs/node-map.html` is generated - never hand-edit it. Edit the generator
(data and keywords) or `assets/template.html` (the rendering engine, shared
with every other project using this skill), then regenerate.

## Without a generator: scan live

The rest of this document is the fallback for a project that has no
`scripts/build-node-map.js` - you scan and build the data yourself, then write
the generator if the project will need it again.

## Inputs

- **Target project root**: the current working directory, unless the user names
  a different path.
- **Output path**: `<target>/docs/node-map.html`, unless the user asks for a
  different location. Create `docs/` if it doesn't exist.

## Step 1 - Discover categories

A "category" is a top-level grouping worth its own cluster in the graph. Check
for these, in this order, but **only include ones that actually exist** - this
skill must degrade gracefully on projects that don't follow this repo's exact
layout:

| Category label | Typical source                                                        |
| --------------- | ---------------------------------------------------------------------- |
| Memory          | `.claude/memory/*.md`                                                  |
| Skills           | `.claude/skills/*/SKILL.md` (one node per skill folder)                |
| Tickets          | `tickets/{open,closed}/{features,bugs,documentation,infrastructure,research}/*.md` - create SUBCATEGORY nodes for each ticket category (features/bugs/etc.) that contain actual tickets |
| Docs             | `docs/**`, root-level `README.md`, `CHANGELOG.md`                      |
| Source           | `src/**`                                                                |
| Tests            | `tests/**`                                                              |
| Scripts          | `scripts/**`                                                            |
| Assets           | `assets/**`                                                             |
| Prompts/Templates | `.claude/prompts/*.md`, `.claude/templates/*.md`                     |

If the project has none of these (an unfamiliar layout), fall back to its actual
top-level folders (excluding noise, see below) as categories instead of
forcing it into this list.

**Always exclude** (never list individually, never recurse into):
`.git`, `node_modules`, `.venv`, `__pycache__`, `dist`, `build`, `.vs`,
`.vscode`, any folder already covered as a category output path itself
(e.g. don't recurse into `docs/node-map.html`'s own directory listing infinitely
- just skip prior generated node-map HTML files), binary build artifacts,
`.gitkeep` placeholder files, and any file that may hold secrets (`.env` and
similar) - never surface its name or path in the graph.

Skip a category entirely (don't render an empty cluster) if, after exclusions,
it has zero files.

## Step 2 - Collect file metadata per category

Prefer one shell call per category over reading files individually - this is
metadata only (name, size, modified date), not file content.

PowerShell (Windows, primary in this environment):

```powershell
Get-ChildItem -Path ".claude/memory" -File | Select-Object Name, Length, LastWriteTime | ConvertTo-Json
```

Bash equivalent (if running on a POSIX shell / non-Windows host):

```bash
find .claude/memory -maxdepth 1 -type f -printf '%f\t%s\t%TY-%Tm-%TdT%TH:%TM:%TS\n'
```

For each file, capture: `label` (filename), `size` (bytes, format to a short
human string like `"2.1 KB"`), `modified` (ISO date or relative "3d ago" - your
choice, keep it short), and `path` (repo-relative path for the tooltip).

**Cap large categories.** If a category has more than ~60 files, include the 60
most recently modified and fold the rest into one synthetic node labeled
`"+N more files"` (no path, larger size to stand out) so the layout stays 
legible instead of choking on hundreds of dots. This "+N more files" node 
should be visually distinct (larger radius) in the rendering.

## Step 3 - Determine the center node

- `label`: `"CLAUDE.md"` if a CLAUDE.md exists at the project root or in
  `.claude/`, otherwise the project's folder name.
- `sublabel`: a short phrase - e.g. the project name from `project_config.md`,
  or `"project brain"` if nothing better is available.

## Step 4 - Build the data block

Assemble JSON matching this schema:

```json
{
  "project": "string - project name",
  "generated": "ISO 8601 timestamp",
  "totalFiles": 0,
  "center": { "label": "string", "sublabel": "string" },
  "categories": [
    {
      "id": "short-slug",
      "label": "Display Label",
      "nodes": [
        { "label": "filename.ext", "meta": "2.1 KB · 3d ago", "path": "relative/path",
          "keywords": "optional extra search terms, not displayed" }
      ],
      "subcategories": [
        {
          "id": "short-slug",
          "label": "Subcategory Label",
          "nodes": [
            { "label": "filename.ext", "meta": "2.1 KB · 3d ago", "path": "relative/path",
              "keywords": "optional extra search terms, not displayed" }
          ]
        }
      ]
    }
  ]
}
```

**totalFiles**: Count of actual files across all categories/subcategories (excludes "+N more files" synthetic nodes). This is displayed in the search bar as "N files" not "N nodes".

**subcategories** (optional): For categories like Tickets that have natural subdivisions (features/bugs/etc.), create subcategory nodes that sit between the category node and the file nodes. Subcategories form an intermediate ring in the radial layout.

Category `color` is optional - omit it and the template assigns one from its
built-in palette automatically, in category order. Only set `color` explicitly
if the user asks for specific colors.

`keywords` is optional and per-node. It is never rendered - it only feeds
`brain.js`, which scores it at weight 2 (above a path match, below a filename
match). Use it for files whose name doesn't say what they answer: nothing is
called `definition-of-done.md`, so the entry point carries
`"commit message format definition of done ticket workflow"` and a query for
any of those finds it. Don't pad every node with keywords - a long list on a
common file makes it win queries it shouldn't.

**Label ticket nodes with their description**, not the bare filename:
`"TICKET-0077 separate terminal lifecycle hooks"` rather than
`"0077-Terminal-hooks.md"`. Ticket numbers are unmatchable by topic, and since
the label is weighted 3x this is the single highest-value labelling decision in
a ticket-heavy repository.

## Step 5 - Inject and write the output file

1. Read `.claude/skills/node-map/assets/template.html` (this skill's engine -
   do not modify it in place; it's the reusable source of truth for every
   project this skill runs against).
2. Replace the contents of the
   `<script id="node-map-data" type="application/json">...</script>` block with
   your generated JSON (the placeholder demo data lives there by default -
   overwrite the whole block's inner text).
3. If any string value could contain the literal sequence `</script>` (rare -
   e.g. a filename), escape it as `<\/script>` so it doesn't terminate the tag
   early.
4. Write the result to `<target>/docs/node-map.html` (creating `docs/` if
   needed). Never edit the template file itself as part of a run.

## Step 6 - Report back

Tell the user: the output path, the category/node counts, and that it opens
directly in any browser (double-click, or `start docs/node-map.html` on
Windows / `open` on macOS). Mention the controls: scroll to zoom, drag to pan,
drag a node to reposition it, click to inspect/highlight connections,
double-click to fly to a node, click empty space to reset.

## Notes on the engine itself

`assets/template.html` is a hand-built, dependency-free force-directed graph
(no D3, no CDN) so the output works fully offline. It re-simulates physics
continuously in the browser (gentle ambient motion, never fully freezes) and
supports pan/zoom/drag/hover/click/double-click out of the box - none of that
needs to be regenerated per project. Your only job each run is producing the
JSON data block; treat the rest of the file as a stable library.

If you improve the engine itself (new interaction, visual fix, perf work), edit
`assets/template.html` directly and it improves every future project this
skill is used on - just make sure the demo placeholder data block still parses
and renders on its own, since that's what a fresh copy of this skill ships with.
