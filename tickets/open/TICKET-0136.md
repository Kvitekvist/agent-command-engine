# TICKET-0136: Explicit project removal and agent cleanup

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-10, from the ACE audit of 2026-09-13.

## Implementation Plan

Confirm affected sessions and dirty files; perform all project agent cleanup in main while preserving files and history.

## Files Modified

main/ipc/handlers.js; renderer/components/Sidebar.jsx; tests/audit-regressions.test.js.

## Testing

Registered handler regression proves unvisited cleanup leaves another project's session alone. Remaining: click-through dirty-editor cancellation and persisted history review.

## Result

Main stops and deletes every registered agent of the removed project, including unvisited projects. Dialog lists sessions and dirty files; project files and historical mappings are retained.

## Closed

Pending.
