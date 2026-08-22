# TICKET-0080

**Status**

Open

**Type**

Refactor

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Separate database migrations from domain persistence repositories.

## Reason

DBService combines schema lifecycle, migrations, and all repository operations, increasing change coupling.

## Implementation Plan

* [ ] Extract migration definitions
* [ ] Extract repository boundaries incrementally
* [ ] Preserve schema compatibility and tests

## Files Modified

---

## Testing

* [ ] `npm test`
* [ ] Migration compatibility checks

## Result

---

## Notes

---

## Closed

---
