# TICKET-0142: Usage history request identity

**Status**

Closed

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-25, from the ACE audit of 2026-09-13.

## Implementation Plan

Discard stale project/request responses and settle local loading errors.

## Files Modified

renderer/views/TokenView.jsx.

## Testing

Hidden Electron resolves A/B history in reverse order and verifies B remains visible. Removing the active project during a pending request leaves empty history after it resolves. Production build passes.

## Result

Project/request identity guards history responses and cleanup invalidates pending requests. Loads clear old rows and settle error/loading state.

## Closed

2026-09-14.
