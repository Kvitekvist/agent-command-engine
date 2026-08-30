# TICKET-0080 — Separate database migrations from domain persistence repositories

**Status**

Closed

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
* [ ] Enable and test foreign-key enforcement and project-removal policy
* [ ] Add integrity checks, recoverable backups, and failed-write recovery
* [ ] Avoid unnecessary synchronous whole-database exports where practical
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

2026-08-30 — Won't do. Speculative split of a 333-line DBService. FK enforcement + backups are worth a small dedicated ticket if wanted, not this refactor. (Backlog triage 2026-08-30.)

---
