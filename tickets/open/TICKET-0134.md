# TICKET-0134: Shared Notes concurrency and format

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-07, 08, 19, 33, from the ACE audit of 2026-09-13.

## Implementation Plan

Move mutations to main with disk revision conflicts, stable entry IDs, JSON-lines format with legacy reading, error-preserving UI, search/edit/undo and project access.

## Files Modified

main/services/NotesService.js, notes.mjs, FileService.js; renderer/components/NotesPanel.jsx; App.jsx; notes tests and hidden renderer smoke.

## Testing

Automated merge/external-append/stale-edit/format tests and hidden Electron failed/delayed-save checks pass. Remaining: real provider bracketed-paste insertion and extended two-panel keyboard review.

## Result

Main re-reads before ID-based mutations, rejects stale edits and duplicate IDs, uses JSON Lines with legacy CRLF parsing, and retains failed drafts. Search/edit/undo and project-only access are implemented.

## Closed

Pending.
