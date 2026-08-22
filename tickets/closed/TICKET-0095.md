# TICKET-0095 — Add a build-node-map skill and helper scripts

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Add a `/build-node-map` skill and matching `build_node_map.bat` /
`build_node_map.sh` helper scripts so regenerating the second brain is a
single documented command rather than a remembered `node` invocation.

## Reason

TICKET-0093 introduced `scripts/build-node-map.js`, but nothing surfaces it.
The generic `/node-map` skill still describes a live rescan, which in this
repository silently drops the curated `KEYWORDS` map and the ticket-description
labelling that make retrieval work here. Anyone who reaches for the obvious
slash command gets the wrong behaviour, and the correct command exists only as
a sentence inside `.claude/CLAUDE.md`.

The repository also pairs every helper script as `.bat` + `.sh`
(`build`, `run`, `setup`, `clear_cache`), and ACE targets macOS as well as
Windows, so a Windows-only helper would break that pattern.

## Implementation Plan

* [x] Add `scripts/build_node_map.bat` following the existing `.bat` conventions
* [x] Add `scripts/build_node_map.sh` for parity with the other helper pairs
* [x] Add a `build-node-map` skill that runs the generator and explains when to use it instead of `/node-map`
* [x] Point `AGENTS.md` and `.claude/CLAUDE.md` at the skill
* [x] Verify both scripts regenerate the map correctly and fail loudly when Node is missing

## Files Modified

- `.claude/skills/build-node-map/SKILL.md` — new skill
- `scripts/build_node_map.bat` — Windows helper
- `scripts/build_node_map.sh` — macOS/Linux helper
- `scripts/build-node-map.js` — `KEYWORDS` entries for the two skills and the generator
- `AGENTS.md`, `.claude/CLAUDE.md` — point at the skill and the helpers
- `docs/node-map.html` — regenerated
- `CHANGELOG.md`

## Testing

* [x] `bash scripts/build_node_map.sh` regenerates the map and reports counts
* [x] `cmd /c scriptsuild_node_map.bat` does the same on Windows
* [x] Both fail loudly with a clear message when Node is absent from PATH, and
      when the generator exits non-zero
* [x] `npm test` from `src/` — 68 passed, 1 skipped, 0 failed
* [x] All Markdown links resolve (0 broken)
* [x] Retrieval check: `"rebuild the node map"` and `"how do I refresh the
      second brain"` both return the new skill first

## Result

Implemented. `/build-node-map` is now the discoverable way to rebuild the
second brain, and the helper scripts give the same thing from a terminal on
either platform.

Regenerating first exposed a retrieval problem worth recording: the query
`"rebuild the node map"` returned the three build scripts in a three-way tie
at 40.7 and did not surface the skill at all, because the scripts match on
both filename and path while the skill node is labelled only `build-node-map`.
`brain.js`'s low-confidence warning fired correctly. Adding a `KEYWORDS` entry
for the skill fixed it — the skill now leads at 60.9 with the tie gone — which
is the field from TICKET-0093 doing exactly the job it was added for.

## Notes

The `.sh` helper was not requested but the repository pairs every helper
script (`build`, `run`, `setup`, `clear_cache`) as `.bat` + `.sh`, and ACE
targets macOS as well as Windows, so a Windows-only helper would have been the
odd one out.

This skill is deliberately ACE-specific and is not part of the shared
`node-map` skill: it exists because ACE has a committed generator that a live
rescan would bypass. Another project adopting the same pattern would need its
own copy.

## Closed

2026-08-22
