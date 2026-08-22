# TICKET-0078 — Extract permission-prompt detection and response retry policy

**Status**

Open

**Type**

Refactor

**Priority**

Medium

**Created**

---

## Description

Extract permission-prompt detection and response retry policy from the PTY host.

## Reason

PTY session transport and provider-specific approval interaction have separate responsibilities and test boundaries.

## Implementation Plan

* [ ] Create an isolated permission responder
* [ ] Retain PTY host as transport/session manager
* [ ] Add output-fixture tests for responder behavior

## Files Modified

---

## Testing

* [ ] `npm test`

## Result

---

## Notes

---

## Closed

---
