# TICKET-0083 — Reconcile Audit Log, Token History, Load Balancing, and Optimization

**Status**

Open

**Type**

Enhancement

**Priority**

High

**Created**

2026-08-22

---

## Description

Reconcile Audit Log, Token History, Load Balancing, and Optimization Advisor
with ACE's canonical interactive terminal agent path.

## Reason

Audit and optimization still consume the legacy headless `prompts` table,
which interactive terminals do not populate. User-facing analytics must either
use real interactive-session data or be removed rather than presenting stale
historical results as current functionality.

## Implementation Plan

* [ ] Define provider-neutral interactive session and turn telemetry
* [ ] Map provider transcripts/tokscale sessions to ACE agents without logging secrets
* [ ] Rebuild Audit and Optimization Advisor on the canonical data source
* [ ] Remove obsolete headless-only APIs and persistence after migration
* [ ] Document retention, privacy, provider gaps, and failure behavior

## Files Modified

---

## Testing

* [ ] Transcript/usage fixture tests for Claude and Codex
* [ ] Audit and advisor integration tests
* [ ] Live verification with both providers

## Result

---

## Notes

Coordinate with TICKET-0076 and TICKET-0080.

## Closed

---
