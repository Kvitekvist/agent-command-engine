# TICKET-0079

**Status**

Open

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Introduce an explicit terminal-session lifecycle policy for agents across project changes.

## Reason

Every visited project remains mounted in the renderer to preserve PTYs, causing unbounded retained UI/session state.

## Implementation Plan

* [ ] Define background-session and eviction behavior
* [ ] Model sessions separately from visible cards
* [ ] Add lifecycle tests

## Files Modified

---

## Testing

* [ ] `npm test`
* [ ] `npm run build`

## Result

---

## Notes

---

## Closed

---
