# TICKET-0138: Detect editor disk conflicts

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-12, from the ACE audit of 2026-09-13.

## Implementation Plan

Compare the expected disk content in main, use temporary-file replacement, offer Reload/Compare/Overwrite while retaining the unsaved buffer.

## Files Modified

main/services/FileService.js; main/ipc/handlers.js; main/preload.js; renderer/views/EditorView.jsx; tests/audit-regressions.test.js.

## Testing

Conflict regression and build pass. Remaining: manual conflict choices with agents editing externally. A final external check/rename race remains documented.

## Result

Editor writes carry loaded content. Main returns disk conflicts without replacing external bytes; UI offers comparison, Reload, Cancel and explicit Overwrite. Temporary sibling writes preserve the original on failures.

## Closed

Pending.
