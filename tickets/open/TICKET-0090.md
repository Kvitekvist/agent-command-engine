# TICKET-0090 — Add local search and filtering across projects, agents, sessions

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

Add local search and filtering across projects, agents, sessions, transcripts,
audit events, changed files, and outcomes with explicit retention controls.

## Reason

As ACE accumulates projects and sessions, terminal cards and per-project views
are insufficient for locating prior decisions, failures, or completed work.

## Implementation Plan

* [ ] Define searchable metadata and privacy/retention rules
* [ ] Add indexed local search over canonical interactive telemetry
* [ ] Add filters for project, provider, agent, status, date, and outcome
* [ ] Link results to sessions, files, and review state
* [ ] Add indexing, migration, deletion, and scale tests

## Files Modified

---

## Testing

* [ ] Search relevance and filter tests
* [ ] Retention/deletion tests
* [ ] Large-history performance test

## Result

---

## Notes

Depends on TICKET-0083 and TICKET-0080.

## Closed

---
