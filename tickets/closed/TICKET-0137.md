# TICKET-0137: Save the exact editor snapshot

**Status**

Closed

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-11, from the ACE audit of 2026-09-13.

## Implementation Plan

Carry written content to the saved baseline and preserve newer typing and failed saves.

## Files Modified

renderer/views/EditorView.jsx; renderer/store/useStore.js; tests/editor-store.test.js; scripts/smoke-renderer.js.

## Testing

Delayed snapshot store regression and hidden Electron failed-save buffer retention pass; production build passes.

## Result

Saved baseline is the exact content sent to disk, not newer typing. Rejected saves never mark current content clean.

## Closed

2026-09-14.
