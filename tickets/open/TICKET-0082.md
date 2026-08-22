# TICKET-0082 — Add optional per-agent Git worktree and branch isolation, with an ACE

**Status**

Open

**Type**

Feature

**Priority**

High

**Created**

2026-08-22

---

## Description

Add optional per-agent Git worktree and branch isolation, with an ACE review
flow for inspecting, merging, cherry-picking, or discarding each agent's work.

## Reason

Every concurrent agent currently runs in the same project directory. Agents
can overwrite one another's edits or accidentally commit unrelated work,
undermining ACE's core multi-agent workflow.

## Implementation Plan

* [ ] Design worktree lifecycle, naming, dirty-tree safeguards, and cleanup policy
* [ ] Launch isolated agents in their assigned worktree and persist the mapping
* [ ] Add changed-file, commit, test-status, merge/cherry-pick, and discard UI
* [ ] Replace blind commit flows with a review/confirmation step
* [ ] Add conflict, recovery, and cleanup tests

## Files Modified

---

## Testing

* [ ] Unit tests for worktree policy and command construction
* [ ] Integration tests against a temporary Git repository
* [ ] Manual concurrent-agent conflict and merge verification

## Result

---

## Notes

Depends on the session ownership work in TICKET-0079. TICKET-0075 should land
first if new worktree IPC channels are required.

## Closed

---
