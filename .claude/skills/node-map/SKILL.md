---
name: node-map
description: Generate a project "second brain" - an interactive, self-contained HTML node-network dashboard (central CLAUDE.md, memory, skills, tickets, docs, source, and other conventional folders as a dark glowing radial graph) plus a deterministic retrieval script (brain.js) that finds files by keyword score instead of an open-ended Grep/Glob sweep, cutting tokens and latency on "where is X" / "which file has Y" questions. Use when the user asks to visualize, map, or chart the project's structure/memory/skills as a node graph or "brain" dashboard, asks for a second-brain / memory-retrieval system, or explicitly invokes /node-map.
---

# node-map

This skill has two parts, and the visual is not the point on its own - it's
the smaller half:

1. **The dashboard** - one self-contained HTML file rendering the target
   project as a radial node graph: a central "brain" node (CLAUDE.md, or the
   project itself), a ring of category nodes, and a cluster of file nodes
   around each. No build step, no dependencies - opens in any browser,
   offline. It also doubles as the interactive interface for browsing the
   second brain: an interactive control panel (layout switcher, department/
   folder view toggle, search, expand/collapse, "bake settings") lets a
   human explore it directly.
2. **`brain.js`** - a deterministic retrieval script that reads that same
   dashboard's embedded data and scores candidate files against a query by
   filename/path/category keyword match, with no file content read and no
   model call. This is the part that actually saves tokens and time: instead
   of Claude running a broad Grep/Glob sweep to answer "where do we track X"
   or "which file configures Y", it runs `brain.js` first and reads only the
   top-ranked candidate(s). See "Retrieval protocol" below - this is a
   behavior change for *every future session* in a project that has this
   skill's output, not just something that runs at generation time.

You (Claude) do the scanning and data-building yourself, live, each time this
skill runs. There is no separate generator script for the dashboard - `brain.js`
is the one piece of static logic, and it's dependency-free Node.js so it runs
anywhere Claude Code runs.

> **In this repository (ACE), regenerate with `node scripts/build-node-map.js`
> instead of scanning live.** That committed script holds ACE's curated
> `keywords` map and its ticket-label logic, both of which a live rescan would
> silently drop. Everything below still describes the data format it emits.

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
| Skills           | `.claude/skills/*/SKILL.md` (one node per skill folder - **label it with the folder name**, e.g. `duckdb-diagnosis`, never the literal filename `SKILL.md`, or every skill collapses into one indistinguishable label for both the graph and `brain.js` retrieval, see below) |
| Tickets          | `tickets/open/*.md`, `tickets/closed/*.md` (split into two categories if both are non-trivial in size, otherwise merge) |
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
`"+N more"` (no path) so the layout stays legible instead of choking on
hundreds of dots.

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
  "center": { "label": "string", "sublabel": "string" },
  "categories": [
    {
      "id": "short-slug",
      "label": "Display Label",
      "nodes": [
        { "label": "filename.ext", "meta": "2.1 KB · 3d ago", "path": "relative/path",
          "keywords": "optional extra search terms, not displayed" }
      ]
    }
  ]
}
```

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
`"TICKET-0077.md"`. Ticket numbers are unmatchable by topic, and since the
label is weighted 3x this is the single highest-value labelling decision in a
ticket-heavy repository.

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
double-click to fly to a node, click empty space to reset - plus the control
panel (top right, `MENU` to toggle): Layout (Force / Circle / Hex / Rings -
Rings and the others animate the whole graph into an organized arrangement,
this is the "sort" action), View (Departments = the curated categories above,
Folders = the same files regrouped by their actual on-disk subfolder), a
search box (press `/` to focus it), per-category expand/collapse (click a
legend row, or the Expand all / Collapse all buttons), and "Bake settings"
(saves the current layout/view/slider choices to this file's local storage
so they persist next time it's opened).

Also mention `brain.js` and suggest (don't do it silently - it edits a file
outside this skill's own output) adding a short pointer to the project's
CLAUDE.md/AGENTS.md so future sessions actually use it - see below.

## Retrieval protocol - use brain.js instead of broad search

Once `docs/node-map.html` exists for a project, **in this session and any
future one**, prefer this over an open-ended Grep/Glob sweep whenever a
question is really "where is the file/section about X":

```bash
node .claude/skills/node-map/assets/brain.js "<question or keywords>"
```

- Reads `docs/node-map.html`'s embedded data (no separate index file to keep
  in sync) and scores every known file by keyword overlap against its
  filename, path, and category - deterministic, no file content opened, no
  model call.
- Exit code `0` with ranked results printed to stdout when it finds
  candidates - read the top one (or two, if scores are close) directly
  instead of searching further.
- Exit code `1` with "no candidates matched" when nothing scores - fall back
  to normal Grep/Glob as usual. Don't treat a miss as an error.
- `--json` for structured output, `--top N` to change how many results (default 5).

This only helps if file/folder names are descriptive (it has no content
index in v1 - see project_memory.md's Future Ideas) and if the dashboard is
reasonably fresh - suggest regenerating it if the project has changed a lot
since `docs/node-map.html`'s `generated` timestamp.

**Suggest, once, to the user** (don't silently edit another file) adding a
line like this near the top of the project's `CLAUDE.md` or `AGENTS.md`
("Every Session" / "before writing code" section, wherever it already reads
project context) so the habit sticks across sessions without needing to
re-discover this skill each time:

```
Before an open-ended search for a specific file/document, try:
  node .claude/skills/node-map/assets/brain.js "<question>"
and read the top-ranked result before falling back to Grep/Glob.
```

## Notes on the engine itself

`assets/template.html` is a hand-built, dependency-free force-directed graph
(no D3, no CDN) so the output works fully offline. It re-simulates physics
continuously in the browser (gentle ambient motion, never fully freezes),
supports pan/zoom/drag/hover/click/double-click, and includes the full control
panel (four layout modes, department/folder view, search, expand/collapse,
settings persisted via localStorage) out of the box - none of that needs to
be regenerated per project. Your only job each run is producing the JSON data
block; treat the rest of the file as a stable library.

`assets/brain.js` is the other stable asset - plain Node.js, zero dependencies,
reads whatever `docs/node-map.html` it's pointed at. It doesn't need
regenerating either; it's generic over the data schema.

If you improve either file (new layout, better scoring, a bug fix), edit it
directly in `assets/` and it improves every future project this skill is used
on - just make sure the demo placeholder data block in `template.html` still
parses and renders on its own, since that's what a fresh copy of this skill
ships with.
