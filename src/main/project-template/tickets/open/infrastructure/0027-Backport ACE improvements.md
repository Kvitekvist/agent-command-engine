# TICKET-0027

**Status**

Awaiting verification

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-22

**Parent Ticket**

None

**Child Tickets**

None

**Dependencies**

None

---

## Description

Backport the framework improvements that the ACE project made after forking
from this template: a provider-neutral `AGENTS.md` entry point, keyword-aware
`brain.js` retrieval, a committed node-map generator, cross-platform shell
scripts, and CI.

---

## Reason

ACE diverged from the template while working through ~95 tickets, and several
of its changes are template-level rather than ACE-specific. Keeping them only
in ACE means every future project started from this template repeats the same
discovery.

---

## Implementation Plan

* [x] Add root `AGENTS.md` (routing table, canonical sources, ticket workflow,
  definition of done, validation) and reduce `.claude/CLAUDE.md` to a thin
  Claude-specific pointer
* [x] Add the code-writing ladder (YAGNI, reuse, stdlib, native, minimum diff)
  to `AGENTS.md`
* [x] Replace `brain.js` with the keyword-aware version (per-node `keywords`
  scored at weight 2) and document the field in the node-map skill
* [x] Add `scripts/build-node-map.js`, a committed generator that preserves the
  curated `KEYWORDS` map and labels ticket nodes with their description
* [x] Merge the `build-node-map` skill into `node-map` - one skill, not two
* [x] Add `.sh` siblings for setup/run/build/clear_cache/build_node_map and a
  single `run_tests.sh` entry point
* [x] Add `.github/workflows/tests.yml` running `scripts/run_tests.sh`
* [x] Add `docs/agents/{current-state,architecture-guide,conventions}.md`
* [x] Add the status vocabulary to `tickets/TEMPLATE.md`
* [x] Delete the FlowGrid install notes under `docs/` and the committed session
  junk (`.claude/temp_nodedata.json`, `.claude/calibration/`), strip the seven
  skills' citations pointing at them, and regenerate the map

---

## Files Modified

* `AGENTS.md` (new)
* `.claude/CLAUDE.md` (rewritten as a pointer)
* `.claude/skills/node-map/SKILL.md`, `.claude/skills/node-map/assets/brain.js`
* `scripts/build-node-map.js`, `scripts/build_node_map.{bat,sh}`
* `scripts/{setup,run,build,clear_cache,run_tests}.sh`
* `.github/workflows/tests.yml` (new)
* `docs/agents/*.md` (new), `docs/node-map.html` (regenerated)
* `tickets/TEMPLATE.md`, `.gitignore`

---

## Testing

* `node scripts/build-node-map.js` - regenerates the map, prints category and
  file counts
* `node .claude/skills/node-map/assets/brain.js "commit message format
  definition of done"` - returns `AGENTS.md` first, via its curated keywords
* `bash scripts/run_tests.sh` - exits 0 with "no tests configured yet"
* `bash scripts/build_node_map.sh` - regenerates and verifies the output file

Not yet verified: `docs/node-map.html` rendering in a browser, and the CI
workflow on a real push.

---

## Result

Implemented in full. `brain.js` retrieval, the generator, the shell scripts,
and `run_tests.sh` were all exercised locally; the browser rendering of
`docs/node-map.html` and the CI workflow on a real push are still unverified,
hence the status.

---

## Notes

`template.html` was deliberately NOT taken from ACE: this repository's copy is
newer (subcategory ring, accurate `totalFiles`) and ACE's would regress it.
The same holds for `scripts/next_ticket.js` and the skills ACE dropped.

---

## Token Usage

<!-- Run /log-cost and paste /cost output to populate this section -->

| Session | Input | Output | Cache Read | Cache Write | Cost |
|---------|-------|--------|------------|-------------|------|
| | | | | | |

---

## Closed

YYYY-MM-DD
