# TICKET-0139: Guard window close with dirty editors

**Status**

Open

**Type**

Bug / Feature

**Priority**

High

**Created**

2026-09-13

## Description

AUDIT-13, from the ACE audit of 2026-09-13.

## Implementation Plan

Use an explicit close request and response IPC; Save/Discard/Cancel; failed saves prevent shutdown.

## Files Modified

main/index.js; main/preload.js; renderer/App.jsx; scripts/smoke-renderer.js and preload.

## Testing

Hidden Electron checks Cancel, failed Save all and successful Save all. Remaining: actual window X, application/keyboard Quit and macOS close/reopen.

## Result

Main waits for an authorized renderer decision before closing/quitting. Save failures and Cancel keep the window and buffers.

## Closed

Pending.
