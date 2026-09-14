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

### Audit continuation, 2026-09-14

Move global removal to Advanced/Maintenance; per-provider native confirmation names package and external-terminal impact.

* [x] `prereqs:uninstall` IPC handler — `npm uninstall -g` for every entry in
  `PREREQ_PACKAGES`, same result shape as `prereqs:install`.
* [x] Expose `window.ace.prereqs.uninstall()` in `preload.js`.
* [x] `PrereqChecklist` renders an "Uninstall CLIs" button + `OperationFeedback`
  when `allowUninstall` is set; re-checks status after.
* [x] `SettingsView` passes `allowUninstall`.

---

## Files Modified

Audit continuation: PrereqChecklist.jsx, SettingsView.jsx, handlers.js, preload.js.

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/PrereqChecklist.jsx`
- `src/renderer/views/SettingsView.jsx`
- `CHANGELOG.md`

---

## Testing

Audit continuation: No global CLI was removed. Remaining check: cancel without running npm, then remove one provider in a disposable environment and verify the other remains.

- `npm test` (from `src/`) — existing suite.
- Current manual check: Settings > Advanced/Maintenance, choose one provider,
  cancel and verify no command runs. In a disposable environment, confirm removal
  names only that package, its row changes to Not found, and the other CLI remains.

---

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Node.js / npm / git are deliberately not touched — ACE never installed them
(it links out), so it has no business removing them.

---

## Closed
