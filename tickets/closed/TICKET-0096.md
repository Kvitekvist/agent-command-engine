# TICKET-0096 — Bundle and spawn the project scaffold

**Status**

Closed

**Type**

Feature

**Priority**

High

**Created**

2026-08-23

---

## Description

Creating a project through `+` → `New` must populate it from a scaffold bundled with ACE instead of creating an empty directory or reading an external template folder.

---

## Reason

The current flow intentionally replaced a broken hardcoded template path with `mkdir`, but a new ACE project is expected to contain the standard project files and agent setup.

---

## Implementation Plan

* [x] Copy the tracked contents of the reference Template project into an internal scaffold, excluding local `.git`, `.vs`, and `.env` state.

* [x] Copy the bundled scaffold when handling `projects:createNew`, preserving collision and error handling.

* [x] Package the scaffold as an application resource and add a focused regression test.

* [x] Update the changelog and node map, then run tests and build.

---

## Files Modified

- `src/main/project-template/` (95 resource files; two ignored empty directories are recreated by the service)
- `src/main/services/ProjectScaffoldService.js`
- `src/main/ipc/handlers.js`
- `src/package.json`
- `src/tests/project-scaffold.test.js`
- `scripts/build-node-map.js`
- `docs/node-map.html`
- `docs/agents/current-state.md`
- `CHANGELOG.md`
- `tickets/closed/TICKET-0096.md`

---

## Testing

- `npm test`: 69 passed, 1 skipped, 0 failed.
- `npm run build`: passed.
- Focused scaffold test verifies nested/hidden files, `.gitkeep` restoration, collision refusal, and path traversal rejection.
- Compared the internal scaffold against all 97 Git-tracked reference-template files by relative path and SHA-256 content.
- Packaged an isolated Windows directory build and verified its 95 resource files generate all 97 reference-template files, including `build/.gitkeep` and `releases/.gitkeep`.

---

## Result

`+` → `New` now copies ACE's bundled project scaffold into the selected new directory. Runtime project creation has no dependency on `C:\Users\jensr\Documents\VS Projects\Template` or any other external template path.

---

## Notes

electron-builder excludes `.gitkeep` files. The bundled resource uses `.ace-gitkeep` transport placeholders, which the scaffold service restores to `.gitkeep` in each new project. The reference scaffold's own `.gitignore` also excludes transport placeholders under `build/` and `releases/`, so the service recreates those two empty directories explicitly.

---

## Closed

2026-08-23
