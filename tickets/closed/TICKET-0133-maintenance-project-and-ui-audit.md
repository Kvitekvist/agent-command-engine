# TICKET-0133: Project and enterprise UI audit

**Status**

Closed

**Type**

Maintenance

**Priority**

Medium

**Created**

2026-09-13

## Description

Audit the current working tree for correctness, stale or unused code, and UI improvements for an enterprise utility. Record each actionable suggestion as a separate entry in `.ace/notes.txt` for handoff to another agent. This ticket covers the audit and note delivery, not implementation of the findings.

## Implementation Plan

* [x] Read current architecture, conventions, active tickets, and affected code. Preserve existing uncommitted work.
* [x] Run the existing tests and build, inspect the running application, and reproduce selected findings with isolated temporary probes.
* [x] Append individual notes with evidence, priority, a focused recommendation, and acceptance checks. Reference existing tickets where applicable.
* [x] Verify the notes using ACE's parser and confirm the three existing notes remain intact.

## Files Modified

* `tickets/closed/TICKET-0133-maintenance-project-and-ui-audit.md`
* `.ace/notes.txt` (local shared notes)

## Testing

* `npm test`: 81 passed, 1 skipped, 0 failed.
* `npm run build`: passed. Main renderer JavaScript chunk: 4,541.84 kB before gzip.
* `npm audit --json`: 14 affected packages, 1 critical, 12 high, 1 moderate. Advisory counts are not proof that each issue is exploitable in the packaged app.
* Read-only screenshot of the running ACE window inspected. Other screens reviewed in source; no destructive UI actions or live agent interruption.
* Temporary probes reproduced a project-junction filesystem escape, acceptance of an unrelated top-level IPC origin, same-project unsaved-tab loss, incorrect save completion state, note delimiter collision, and the empty model-selection fallback.
* Notes verification: 42 distinct audit entries added; 45 entries total; original file bytes preserved as a prefix and original three parsed notes unchanged. File size: 38,231 bytes. Highest-priority entry appears first in the reverse-chronological Notes panel.

## Result

Delivered AUDIT-01 through AUDIT-42 as separate entries in `.ace/notes.txt`: 18 P1 items, 23 P2 items, and one P3 cleanup. Each entry includes a finding category, evidence, a suggested change, an acceptance check, and an existing ticket reference where applicable. Confirmed probes, source-review risks, existing backlog items and UI proposals are labelled separately.

The most urgent findings concern project-root authorization, note/editor data loss, and release verification. UI recommendations emphasize truthful agent status, project-scoped tools, a focused terminal layout, predictable navigation and accessibility. Application behavior was not changed.

The audit and requested handoff are complete. Closing this ticket does not close or implement the suggested follow-up work. No standalone claims of exploitability were made from npm advisory counts; installer signing, real-provider action compatibility, all screen sizes and macOS interactions were not exercised live.

## Notes

Existing working-tree changes belong to other tickets and were not modified. Screenshots, npm advisory output, and probe files are outside the repository under the OS temporary directory. No application fixes, commit, or push are part of this audit.

## Closed

2026-09-13
