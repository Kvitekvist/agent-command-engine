# TICKET-0140: Keyboard accessible dialogs and file controls

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-17, from the ACE audit of 2026-09-13.

## Implementation Plan

Fix shared Modal semantics/focus; reuse for rename and convert nested clickable spans to buttons.

## Files Modified

renderer/components/Modal.jsx, ContextMenu.jsx, FileTree.jsx, Sidebar.jsx; renderer/views/EditorView.jsx; scripts/smoke-renderer.js.

## Testing

Hidden Electron verifies modal isolation and Shift+F10/Rename/Cancel focus restoration. ContextMenu now focuses keyboard actions and supports arrow keys. Remaining: full keyboard journey and screen-reader review.

## Result

Shared Modal has dialog semantics, inert background, focus containment/restoration; rename reuses it and file/tab controls are buttons.

## Closed

Pending.
