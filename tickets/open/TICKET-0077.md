# TICKET-0077 — Separate terminal lifecycle and side-effect hooks

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

Separate terminal lifecycle and side-effect hooks from the AgentTerminal presentation component.

## Reason

The component currently owns PTY setup, clipboard access, titles, build capability, git actions, and rendering.

## Implementation Plan

* [ ] Extract terminal-session and clipboard hooks
* [ ] Extract project action/build capability logic
* [ ] Extract auto-title policy and make any extra provider call explicit/configurable
* [ ] Keep behaviour and UI stable with focused tests

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
