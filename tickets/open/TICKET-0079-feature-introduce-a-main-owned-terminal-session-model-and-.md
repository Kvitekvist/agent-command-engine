# TICKET-0079 — Introduce a main-owned terminal-session model and explicit lifecycle

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

Introduce a main-owned terminal-session model and explicit lifecycle policy for
agents across project changes, renderer remounts, host crashes, and idle limits.

## Reason

Every visited project remains mounted in the renderer to preserve PTYs, causing unbounded retained UI/session state.

## Implementation Plan

* [ ] Define background-session and eviction behavior
* [ ] Model sessions separately from visible cards, with output ring buffers
* [ ] Add reconnect, crash/resume, concurrency-limit, and idle-eviction behavior
* [ ] Surface running/awaiting-input/idle/exited/lost states to global consumers
* [ ] Add lifecycle and recovery tests

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
