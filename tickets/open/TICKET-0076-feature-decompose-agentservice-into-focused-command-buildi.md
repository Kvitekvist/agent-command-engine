# TICKET-0076 — Decompose AgentService into focused command-building, stream-parsing

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

Decompose AgentService into focused command-building, stream-parsing, title-generation, and token-reconciliation collaborators.

## Reason

Agent lifecycle coordination is coupled to four independently testable responsibilities.

## Implementation Plan

* [ ] Extract pure helpers/services without changing behaviour
* [ ] Keep AgentService as lifecycle coordinator
* [ ] Preserve and expand unit coverage

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
