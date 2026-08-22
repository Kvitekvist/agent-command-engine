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

* [ ] Define project action configuration and safe command representation
* [ ] Add discovery with user confirmation for common ecosystems
* [ ] Stream output, exit state, duration, and cancellation
* [ ] Integrate results with agent cards and TICKET-0082 review flow
* [ ] Add cross-platform command and cancellation tests

## Files Modified

---

## Testing

* [ ] Configuration/parser tests
* [ ] Cross-platform process tests
* [ ] Manual npm and non-npm project verification

## Result

---

## Notes

IPC additions should follow TICKET-0075.

## Closed

---
