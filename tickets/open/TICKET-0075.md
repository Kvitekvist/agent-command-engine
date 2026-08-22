# TICKET-0075

**Status**

Open

**Type**

Refactor

**Priority**

High

**Created**

2026-08-22

---

## Description

Create a shared IPC contract for channel names and payload boundaries.

## Reason

IPC strings and request shapes are duplicated across main-process handlers, preload, and renderer code.

## Implementation Plan

* [ ] Define shared channel constants and payload conventions
* [ ] Adopt the contract in handlers and preload
* [ ] Add contract-level regression tests

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
