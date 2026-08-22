# TICKET-0088 — Discover installed provider capabilities, authentication health, CLI

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

Discover installed provider capabilities, authentication health, CLI versions,
models, permission features, and resume support instead of relying exclusively
on a hardcoded model catalog.

## Reason

Provider CLIs and subscription model availability change independently of ACE.
Hardcoded models and flags become stale and can make otherwise healthy agents
fail at launch.

## Implementation Plan

* [ ] Define provider adapter and capability schema
* [ ] Probe/cache CLI version, auth state, models, and supported flags
* [ ] Merge discovered capabilities with tested fallbacks
* [ ] Surface compatibility and upgrade guidance in Setup/Settings
* [ ] Add provider fixture and degraded-mode tests

## Files Modified

---

## Testing

* [ ] Claude and Codex capability fixture tests
* [ ] Missing/outdated/unauthenticated CLI tests
* [ ] Live verification against supported CLI versions

## Result

---

## Notes

Coordinate with TICKET-0084 so launch policy consumes the provider adapter.

## Closed

---
