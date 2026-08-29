# TICKET-0103 — Add git to the prerequisite check

**Status**

Awaiting verification

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-29

---

## Description

`prereqs:check` probes node, npm, claude, and codex but not git. ACE now
depends on git for project scaffold auto-init (v0.1.22) and the
ticket → branch → PR workflow (TICKET-0106), so a machine without git on PATH
should be surfaced the same way a missing CLI is.

---

## Reason

Missing git currently fails silently at the first `git init` / branch step
with no guidance, the exact problem TICKET-0055 solved for the provider CLIs.

---

## Implementation Plan

* [x] Add a `git --version` entry to the `prereqs:check` probe list
      (`shell: false`, same as node — it is a real `.exe` on Windows).
* [x] Render a git status row in `PrereqChecklist.jsx` with a
      "Download Git ↗" link (git can't be npm-installed, so no Install button).
* [x] Add `prereqs:openGitDownload` IPC opening https://git-scm.com/downloads.
* [x] Include git in `App.jsx`'s first-run setup gate.

---

## Files Modified

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/PrereqChecklist.jsx`
- `src/renderer/App.jsx`
- `src/tests/prereqs.test.js` (new)
- `CHANGELOG.md`

---

## Testing

`npm test` from `src/`. New `prereqs.test.js` asserts the probe list includes
git. Manual: launch on a machine with git removed from PATH — setup screen
lists git as missing with a working download link.

---

## Result

Implemented. Awaiting a live launch check.

---

## Notes

Git stays a soft prerequisite — the setup screen never hard-blocks (same as
claude/codex).

---

## Closed

