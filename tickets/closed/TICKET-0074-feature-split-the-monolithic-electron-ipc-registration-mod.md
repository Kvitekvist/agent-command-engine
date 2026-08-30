# TICKET-0074 — Split the monolithic Electron IPC registration module

**Status**

Closed

**Type**

Refactor

**Priority**

High

**Created**

2026-08-22

---

## Description

Split the monolithic Electron IPC registration module into domain-specific handler registrars.

## Reason

`src/main/ipc/handlers.js` owns unrelated project, agent, token, file, screenshot, git, build, and prerequisite workflows.

## Implementation Plan

* [ ] Extract domain registrars with explicit dependencies
* [ ] Keep registration composition in a small entry module
* [ ] Add focused IPC registration tests

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

2026-08-30 — Won't do. Speculative decomposition of a 717-line working IPC module. No behavioural gain for an app this size; adds files and indirection. (Backlog triage 2026-08-30.)

---
