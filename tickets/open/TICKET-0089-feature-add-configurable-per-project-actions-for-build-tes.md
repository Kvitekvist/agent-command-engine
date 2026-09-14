# TICKET-0089 — Add configurable per-project actions for build, test, lint, format

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

Add configurable per-project actions for build, test, lint, format, and custom
commands, with streamed output and status visible to agents and the review UI.

## Reason

The current Build action recognizes only a narrow npm/Electron layout. ACE
manages arbitrary coding projects and needs explicit, argument-safe project
tasks rather than more hardcoded framework detection.

## Implementation Plan

### Audit continuation, 2026-09-14

Share main's npm build detection with execution, falling through unrelated src manifests; put Pull/Build once in project toolbar.

* [ ] Define project action configuration and safe command representation
* [ ] Add discovery with user confirmation for common ecosystems
* [ ] Stream output, exit state, duration, and cancellation
* [ ] Integrate results with agent cards and TICKET-0082 review flow
* [ ] Add cross-platform command and cancellation tests

## Files Modified

Audit continuation: ProjectBuild.js, handlers.js, preload.js, AgentView.jsx, AgentTerminal.jsx; audit-regressions.test.js.

---

## Testing

Audit continuation: Root-only, src build, unrelated src/root fallback and missing build regressions pass. Multi-agent layout review remains; broader task-engine scope is not implemented.

* [ ] Configuration/parser tests
* [ ] Cross-platform process tests
* [ ] Manual npm and non-npm project verification

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

IPC additions should follow TICKET-0075.

## Closed

---
