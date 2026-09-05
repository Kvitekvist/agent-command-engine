# TICKET-0126 — Add a "Uninstall CLIs" button to Settings prerequisites

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Low

**Created**

2026-09-05

---

## Description

Settings → General → Prerequisites gains an "Uninstall CLIs" action that runs
`npm uninstall -g` for both provider packages
(`@anthropic-ai/claude-code`, `@openai/codex`). It is the symmetrical
opposite of the existing per-CLI install buttons and exists so a fresh-install
can be tested without hand-running npm.

The button only renders where `PrereqChecklist` is given `allowUninstall`
(Settings), not on the first-run `SetupView` screen.

---

## Reason

Testing "does ACE set itself up on a clean machine" currently means manually
uninstalling the global CLI packages from a terminal. The install path is in
the UI; the reverse should be too.

---

## Implementation Plan

* [x] `prereqs:uninstall` IPC handler — `npm uninstall -g` for every entry in
  `PREREQ_PACKAGES`, same result shape as `prereqs:install`.
* [x] Expose `window.ace.prereqs.uninstall()` in `preload.js`.
* [x] `PrereqChecklist` renders an "Uninstall CLIs" button + `OperationFeedback`
  when `allowUninstall` is set; re-checks status after.
* [x] `SettingsView` passes `allowUninstall`.

---

## Files Modified

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/PrereqChecklist.jsx`
- `src/renderer/views/SettingsView.jsx`
- `CHANGELOG.md`

---

## Testing

- `npm test` (from `src/`) — existing suite.
- Manual: Settings → Prerequisites → Uninstall CLIs, confirm both packages go
  away (`npm ls -g`), rows flip to "Not found", install buttons return.

---

## Result

---

## Notes

Node.js / npm / git are deliberately not touched — ACE never installed them
(it links out), so it has no business removing them.

---

## Closed

