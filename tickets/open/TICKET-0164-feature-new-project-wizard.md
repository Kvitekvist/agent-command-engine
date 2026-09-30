# TICKET-0164: Installer-style new-project wizard

**Status**

Awaiting verification

**Type**

Feature

**Priority**

High

**Created**

2026-09-29

---

## Description

Change + New to choose a parent folder first, then collect the folder name and a required project description. Show the full destination before creating the project.

## Reason

Sidebar currently asks for the name before the folder and captures no project purpose. New projects cannot seed useful memory from this flow.

## Implementation Plan

* [x] Reuse the native folder picker and existing Modal. Provide Back, Cancel and Create controls with accessible labels and inline errors.

* [x] Require a trimmed folder name and project description. Prompt for purpose, intended users and the first useful outcome; reject whitespace-only descriptions without inventing requirements.

* [x] Extend the renderer, preload and projects:createNew contract together. Validate types, bounded text lengths, folder names and native-selected parent authorization in main.

* [x] Preserve entered values on failures, allow retry after name collisions without losing folder authorization, and prevent duplicate submissions.

* [x] Pass the description to the scaffold service for TICKET-0165; refresh the project list after successful creation.

## Files Modified

- `src/renderer/components/NewProjectWizard.jsx` (new): location with "Back: choose another folder", folder name, required description with the purpose / users / first-outcome prompt, the full destination path, Cancel and Create. Errors show inline in a `role="alert"`; values survive failures; a ref blocks double submission.
- `src/renderer/components/Sidebar.jsx`: "✨ New" opens the native picker first and then the wizard; the old name popup and its `alert()` are gone. Other working-tree changes in the file are untouched.
- `src/main/preload.js`: `createNewProject(name, description, parentDir)`.
- `src/main/ipc/handlers.js`: `projects:createNew` validates first and returns `{ error }`; the parent stays authorized until a create succeeds.
- `src/main/services/ProjectScaffoldService.js`: `validateNewProject` (name required, max 100, no `<>:"/\|?*` or control characters, no trailing dot/space, no Windows reserved names; description required, max 4000).
- `src/tests/audit-regressions.test.js`, `src/scripts/smoke-renderer*.js`.

## Testing

- IPC test: invalid characters, `CON`, blank description and a name collision return errors and keep the parent authorized; the retry creates and seeds the project without a new pick; after success the parent needs picking again. The old handler fails the retry step.
- Renderer smoke: folder picked before the form; empty name shows "Enter a folder name."; the destination shows `C:\Smoke parent\Wizard project` (with a space); a double click sends one request (this caught a real double-submit bug, fixed with a ref); a collision error keeps both fields; the retry closes the wizard and lists the project.
- The full renderer smoke passes.
- `npm test`: 146 tests, 144 pass, 1 fail (TICKET-0165's template ticket, see there). `npm run build` passes.
- Not done: the real native picker, keyboard-only walkthrough, and creating a real project in the running app.

## Result

Implemented and committed. Needs a manual run of the real native picker and a real project creation.

## Notes

Depends on TICKET-0165 for seeded output. Coordinate the new IPC payload with that ticket. Existing Sidebar working-tree edits must be preserved.

## Closed

Pending.

