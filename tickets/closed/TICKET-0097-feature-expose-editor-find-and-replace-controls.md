# TICKET-0097 — Expose editor find and replace controls

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-23

---

## Description

Add Find and Replace buttons to the Files editor toolbar. They open Monaco's
built-in find widget, which already provides match navigation and Replace All.

---

## Reason

The Files tab uses Monaco but does not expose its editor search controls in
the visible UI.

---

## Implementation Plan

* [x] Reuse Monaco's built-in Find and Replace actions; do not add a separate search implementation or dependency.
* [x] Add accessible toolbar controls with their existing shortcuts in the tooltip.
* [x] Build the renderer to verify the editor integration.

---

## Files Modified

- src/renderer/views/EditorView.jsx
- CHANGELOG.md

---

## Testing

`npm run build` — passed.

`npm test` — 69 passed, 1 skipped (Windows-only POSIX permission check).

---

## Result

Find and Replace controls open Monaco's native widget. Its existing controls
provide next/previous match and Replace All without duplicating editor logic.

---

## Notes

---

## Closed

2026-08-23
