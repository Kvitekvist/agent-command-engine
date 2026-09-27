# TICKET-0158 — winget Node.js install stops on an ambiguous source

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-27

---

## Description

On a clean VM, Setup's Node.js install failed: winget matched
`OpenJS.NodeJS.LTS` in both the winget and msstore sources and asked for
`--source`, which a hidden process can't answer.

---

## Reason

Blocks first-run setup on fresh Windows installs.

---

## Implementation Plan

* [x] Add `--exact --source winget` to the winget call in `prereqs:installNode`
  and in `scripts/bootstrap-prereqs.ps1`.

---

## Files Modified

- `src/main/ipc/handlers.js`
- `scripts/bootstrap-prereqs.ps1`

---

## Testing

- Clean VM install of v0.1.38 completed Node.js setup (confirmed by the user).

---

## Result

Fixed in v0.1.37.

---

## Notes

---

## Closed

2026-09-27
