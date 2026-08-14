# TICKET-0052: Fix Terminal Paste Truncation for Large Text

**Status:** Open  
**Priority:** Medium  
**Created:** 2026-08-14

---

## Issue

User reports that pasting large amounts of text into the terminal sometimes gets cut off. The clipboard appears to have a limit or the terminal write is being truncated.

Root cause analysis needed: terminal pasting uses `navigator.clipboard.readText()` then writes directly to the PTY session via `window.cpi.terminal.write(sessionId, text)`. For very large pastes, the entire text might overwhelm the PTY buffer or the clipboard API might truncate.

---

## Requirements

* [x] Investigate current clipboard read/write flow
* [x] Add chunked writing for large pastes (>8KB threshold, 4KB chunks)
* [x] Add visual feedback during large paste operations
* [ ] Test with various paste sizes (1KB, 10KB, 100KB, 1MB)
* [ ] Verify no truncation occurs

---

## Implementation Plan

1. Modify AgentTerminal.jsx clipboard paste handlers (Ctrl+V and right-click)
2. Implement chunked writing with small delay between chunks
3. Add optional paste progress indicator for very large pastes (>50KB)
4. Test thoroughly with large code files

---

## Notes

Current paste flow:
- Ctrl+V: `navigator.clipboard.readText()` → `window.cpi.terminal.write(sessionId, text)`
- Right-click: same flow via contextmenu listener

The issue is likely in the ptyHost.js write handling or the PTY buffer itself getting overwhelmed by a single large write. Solution: chunk the paste into smaller pieces with brief delays.

---

## Testing

- [ ] Paste small text (< 1KB) - should work instantly as before
- [ ] Paste medium text (10KB) - should work with chunking
- [ ] Paste large text (100KB) - should work with progress indicator
- [ ] Verify no duplicate text from paste handler conflicts
- [ ] Verify terminal remains responsive during large paste

---

## Implementation

Modified `src/renderer/components/AgentTerminal.jsx`:

1. Added `pasteToTerminal()` helper function that:
   - Detects pastes over 8KB threshold
   - Chunks large pastes into 4KB pieces
   - Adds 50ms delay between chunks to avoid overwhelming PTY buffer
   - Shows progress feedback via OperationFeedback component

2. Updated both paste handlers:
   - Ctrl+V keyboard handler now calls `pasteToTerminal()`
   - Right-click contextmenu handler now calls `pasteToTerminal()`
   - Both include error handling with visual feedback

3. Added paste status state and feedback strip below other operation indicators

The chunking approach:
- Small pastes (<8KB): written immediately, no change in behavior
- Large pastes (≥8KB): chunked with brief delays, shows "Pasting..." progress, then success message with size
- Errors: shown with error message, auto-clear after 6s

This prevents PTY buffer overflow while maintaining responsiveness for normal-sized pastes.

---

## Result

**Implementation complete.** Need to test with real large pastes in the running app:
- Small text paste should work instantly as before
- Large code file paste (e.g. 50KB+ source file) should chunk with progress indicator
- Verify no text is lost during chunking

Build clean. Tests pass. Ready for live verification.
