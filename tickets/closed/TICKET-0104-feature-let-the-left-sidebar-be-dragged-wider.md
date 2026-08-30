# TICKET-0104 — Let the left sidebar be dragged wider

**Status**

Closed

**Type**

Feature

**Priority**

Low

**Created**

2026-08-30

---

## Description

Give the user a way to widen the left navigation/file panel beyond its
fixed width, and remember the chosen width across launches.

## Reason

`Sidebar.jsx` was hardcoded to `w-56` (224px). Long project names and deep
file trees clip; there was no way to make it bigger.

## Implementation Plan

* [x] Replace the fixed `w-56` with a stateful pixel width
* [x] Add a drag handle on the sidebar's right edge (mousedown → track
      `clientX`, clamp 180–600px)
* [x] Persist the width to `localStorage` (`ace:sidebarWidth`), guarded so a
      blocked/empty store falls back to the 224px default

## Files Modified

- `src/renderer/components/Sidebar.jsx`

## Testing

* [x] `npm run build` — clean
* [ ] Manual: drag the handle, release, reload the app — width persists;
      clears cleanly to 224px if localStorage is unavailable

## Result

The sidebar's right edge is a `col-resize` drag handle. Width is clamped to
180–600px and saved per machine in `localStorage`.

## Notes

`localStorage`, not the Zustand store — matches the "lightweight per-viewer
convenience" pattern; the store carries no persistence layer.

## Closed

2026-08-30
