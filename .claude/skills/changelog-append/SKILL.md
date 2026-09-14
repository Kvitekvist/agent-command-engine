---
name: changelog-append
description: Use this skill whenever adding a new entry to CHANGELOG.md as part of closing a ticket. CHANGELOG.md is ~4,800 lines — appending an entry only ever needs the top of the file, never the whole thing. Triggers on "update the changelog", "add a changelog entry".
version: 1.0.0
---

# Appending to CHANGELOG.md without reading all of it

`CHANGELOG.md` is close to 4,800 lines and grows with every release. A new
entry always goes at the top, under the current (or a new) version heading
— nothing about writing a new entry requires knowing what's on line 3,000.

## What to do

1. **Read only the first ~40-50 lines** — enough to see the most recent
   version heading and the `### Added`/`### Changed`/`### Fixed` grouping
   style already in use there.
2. Check `version.txt` for the current version number and decide, same as
   always, whether this change warrants a bump (user-facing change =
   usually yes) or lands under the existing top heading (same-version
   follow-up fix).
3. Write the new entry using `Edit` anchored on the text you just read (the
   top heading or the line right after it) — never `Read` the full file
   first. `Edit`'s old_string only needs to be unique within the file, and
   the top-of-file heading text already is.
4. If you genuinely need historical changelog content (e.g. checking when a
   specific feature shipped), `grep` for it instead of reading the file
   top to bottom.
