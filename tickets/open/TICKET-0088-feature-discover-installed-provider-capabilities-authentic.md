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

### Audit continuation, 2026-09-14

Remove misleading Auto UI and trivial LoadBalancer; migrate legacy preference conservatively. Bound CLI probes and expose failure/retry; gate quick actions per installed provider skills.

* [ ] Define provider adapter and capability schema
* [ ] Probe/cache CLI version, auth state, models, and supported flags
* [ ] Merge discovered capabilities with tested fallbacks
* [ ] Surface compatibility and upgrade guidance in Setup/Settings
* [ ] Add provider fixture and degraded-mode tests

## Files Modified

Audit continuation: LaunchPolicy.js, removed LoadBalancer.js, handlers.js, AgentView.jsx, SettingsView.jsx, AgentTerminal.jsx, ProjectSkillsPanel.jsx, ProcessesView.jsx, PrereqChecklist.jsx.

---

## Testing

Audit continuation: Build and model/launch tests pass. Real Claude/Codex skill invocation and hanging CLI probe still require controlled verification.

* [ ] Claude and Codex capability fixture tests
* [ ] Missing/outdated/unauthenticated CLI tests
* [ ] Live verification against supported CLI versions

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Coordinate with TICKET-0084 so launch policy consumes the provider adapter.

## Closed

---
