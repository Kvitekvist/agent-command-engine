# TICKET-0146: Generate image dialog follow-up

**Status**

Open

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-14

## Description

AUDIT-21 follows the implemented TICKET-0094 image prompt helper. Electron does
not implement window.prompt, so the toolbar needs the shared accessible Modal.

## Implementation Plan

Reuse Modal with a labelled multiline textarea and Generate/Cancel. Retain the
existing prompt helper and interactive Codex PTY path. Send only on Generate.

## Files Modified

src/renderer/components/AgentTerminal.jsx; shared Modal.jsx.

## Testing

Image prompt helper tests and production build pass. The shared dialog is
exercised by the hidden Electron smoke. Still verify Generate and Cancel in a
real authenticated Codex card, including focus returning to its terminal.

## Result

Implemented in the working tree; provider interaction is not yet verified.

## Closed

Pending verification.
