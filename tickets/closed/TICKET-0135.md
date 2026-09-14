# TICKET-0135: Preserve editor buffers on project reselection

**Status**

Closed

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-09, from the ACE audit of 2026-09-13.

## Implementation Plan

Make the store setter a no-op for the same project; retain real-switch confirmation.

## Files Modified

renderer/store/useStore.js; tests/editor-store.test.js.

## Testing

Store regression and production build pass.

## Result

Selecting the same project is a store-level no-op and retains dirty tabs.

## Closed

2026-09-14.
