# TICKET-0084 — Make saved launch defaults and automatic provider routing effective

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-08-22

---

## Description

Make saved launch defaults and automatic provider routing effective for the
interactive agent launch flow, resolving a compatible model after routing.

## Reason

`AgentView` always initializes Claude defaults and always supplies a manual
provider. `LoadBalancer` therefore returns immediately and never performs its
automatic fallback. Settings appear saved but do not affect new interactive
agents, and the seeded threshold is inconsistent with the UI default.

## Implementation Plan

* [x] Add a tested main-process launch policy that resolves provider and model together
* [x] Add an explicit Auto provider choice and load saved defaults in AgentView
* [x] Make Settings support and explain automatic routing
* [x] Repair the inconsistent seeded threshold without clobbering intentional values
* [x] Add focused tests and update user-facing documentation

## Files Modified

* `src/main/services/LaunchPolicy.js`
* `src/main/services/DBService.js`
* `src/main/ipc/handlers.js`
* `src/renderer/views/AgentView.jsx`
* `src/renderer/views/SettingsView.jsx`
* `src/tests/launch-policy.test.js`
* `CHANGELOG.md`
* `tickets/open/TICKET-0084.md`

---

## Testing

* [x] Launch-policy unit tests — 6/6 passed
* [x] `npm test` — 64 passed, 1 platform skip, 0 failed
* [x] `npm run build` — renderer and main builds passed
* [ ] Live Auto/Claude/Codex launch verification

## Result

Implementation and automated verification are complete. The launch bar now
loads Settings defaults, Auto allows LoadBalancer to run, and main resolves a
provider-compatible model before persisting or launching the agent. Invalid
stored provider settings degrade to safe provider defaults. Live provider
launch verification remains before closure.

---

## Notes

This is a corrective slice. Replacing legacy prompt-burn routing with live
quota-aware routing remains in TICKET-0083.

## Closed

---
