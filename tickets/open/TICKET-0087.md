# TICKET-0087 — Add a global agent command center with cross-project status, task

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Add a global agent command center with cross-project status, task ownership,
dependencies, queues, retries, completion criteria, resource limits, and native
notifications when an agent finishes or requires input.

## Reason

ACE can launch many agents but does not yet coordinate their work or surface
background attention states. Users must manually visit terminal cards to learn
whether work is progressing, blocked, or complete.

## Implementation Plan

* [ ] Define task, dependency, status, retry, and completion models
* [ ] Build a global cross-project agent/session overview
* [ ] Add configurable concurrency and quota-aware queueing
* [ ] Add native finished/attention notifications
* [ ] Add dependency scheduling and recovery tests

## Files Modified

---

## Testing

* [ ] Scheduler and state-transition unit tests
* [ ] Notification tests per platform
* [ ] Multi-project workflow verification

## Result

---

## Notes

Depends on the session model in TICKET-0079 and benefits from worktree isolation
in TICKET-0082.

## Closed

---
