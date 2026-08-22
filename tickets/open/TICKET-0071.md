# TICKET-0071 — The project folder was renamed from "Claude Creator" to "ACE"/"Agent

**Status**

Open

**Type**

Refactor

**Priority**

Low

**Created**

2026-08-22

---

## Description

The project folder was renamed from "Claude Creator" to "ACE"/"Agent Command
Engine" some time ago, and user-facing branding (package name, `appId`,
`productName`, README, CHANGELOG, git remote) was already updated to match.
But the app's internal naming was never followed up: the preload API bridge
was still `window.cpi`, the SQLite database file was still `cpi.db`, and
each project's own data folder (screenshots, etc.) was still `.cpi/`.

## Reason

User asked to audit the codebase after renaming the project folder and
refactor anything left over from the old name. Everything user-visible was
already correct; the only remaining leftovers were this internal `cpi`
naming (a stray acronym predating the ACE rename) and a stale, git-tracked
`src/package.json.bak` backup file.

## Implementation Plan

* [x] Rename `window.cpi` → `window.ace` in `preload.js` and every renderer
      call site (12 files, ~60 call sites)
* [x] Rename the SQLite database file `cpi.db` → `ace.db`
      (`DBService.js`), with a one-time migration that renames an existing
      `cpi.db` forward on first launch after upgrading so no install loses
      its data
* [x] Rename the per-project data folder `.cpi/` → `.ace/`
      (`ScreenshotService.js`), updating the `.gitignore` entry it writes,
      with a matching per-project migration that renames an existing
      `.cpi/` folder forward the first time a screenshot is captured after
      upgrading
* [x] Update comments referencing the old names in `index.js`/`handlers.js`
* [x] Delete stale, git-tracked `src/package.json.bak` (unrelated clutter,
      outdated at v0.1.5)
* [x] Update this repo's own `.gitignore` (`.cpi/` → `.ace/`) — its own
      `.ace/screenshots/` folder had just been renamed by hand and needed
      the ignore rule to match
* [x] Update `architecture.md`/`project_memory.md` current-state
      descriptions; left historical ticket files and `ticket_memory.md`
      untouched since they accurately describe what was true at the time
* [x] `README.md` / new `CHANGELOG.md` entry

---

## Files Modified

- src/main/preload.js
- src/main/services/DBService.js
- src/main/services/ScreenshotService.js
- src/main/index.js
- src/main/ipc/handlers.js
- src/renderer/App.jsx
- src/renderer/components/AgentTerminal.jsx
- src/renderer/components/FileTree.jsx
- src/renderer/components/PrereqChecklist.jsx
- src/renderer/components/Sidebar.jsx
- src/renderer/store/useStore.js
- src/renderer/views/AgentView.jsx
- src/renderer/views/AuditView.jsx
- src/renderer/views/EditorView.jsx
- src/renderer/views/SettingsView.jsx
- src/renderer/views/SetupView.jsx
- src/renderer/views/TokenView.jsx
- src/package.json.bak (deleted)
- .gitignore
- README.md
- CHANGELOG.md
- .claude/memory/architecture.md
- .claude/memory/project_memory.md

---

## Testing

- [x] `node --check` on every modified main-process file — clean
- [x] `npm run build` (renderer + main) — clean
- [x] `npm test` — 53/54 (the 1 failure, `pty-perms.test.js`, is the
      pre-existing Windows chmod limitation noted in TICKET-0070, unrelated
      to this change)
- [ ] Live: launch the app against a userData profile that still has the
      old `cpi.db`, confirm it's renamed to `ace.db` on startup and all data
      (projects/agents/settings) is intact; capture a screenshot in a
      project that still has a `.cpi/screenshots/` folder and confirm it's
      renamed to `.ace/` and the new screenshot lands there — deferred per
      this project's usual pattern for main-process changes needing a real
      app restart (see TICKET-0024/0025/etc. in project_memory.md)

---

## Result

Implemented. Build and non-flaky tests pass. Live verification of the two
migrations (existing `cpi.db` → `ace.db`, existing `.cpi/` → `.ace/`) still
open.

---

## Notes

The internal-only naming and the folder/branding rename are separate
concerns — branding was already fully done; this ticket only covers the
`cpi` → `ace` internal naming cleanup discovered while auditing for it.

---

## Closed
