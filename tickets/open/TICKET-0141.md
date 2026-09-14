# TICKET-0141: Reconcile tabs after file operations

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-20, from the ACE audit of 2026-09-13.

## Implementation Plan

Rename descendant editor paths and close trashed tabs only after dirty-buffer confirmation.

## Files Modified

renderer/components/FileTree.jsx; renderer/store/useStore.js; tests/editor-store.test.js.

## Testing

Store descendant rename/trash regression passes. Remaining: manual file operations with dirty tabs and in-project link aliases.

## Result

Successful rename remaps tabs and descendants; trash closes affected tabs and asks before discarding dirty buffers.

## Closed

Pending.
