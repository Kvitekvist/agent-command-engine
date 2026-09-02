# TICKET-0109 — Remove long dashes from README

**Status**

Closed

**Type**

Bug

**Priority**

Low

**Created**

2026-09-02

---

## Description

Remove em and en dashes from README.md.

---

## Reason

The README should not contain long dashes.

---

## Implementation Plan

* [x] Replace long dashes in the README feature list with colons.

* [x] Verify README.md contains no em or en dashes.

---

## Files Modified

* `README.md`

---

## Testing

* `Select-String '[—–]' README.md`: no matches.

---

## Result

Replaced the nine feature-list em dashes with colons.

---

## Notes

---

## Closed

2026-09-02
