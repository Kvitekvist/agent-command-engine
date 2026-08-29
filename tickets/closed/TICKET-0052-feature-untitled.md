# TICKET-0052: Fix Terminal Paste Truncation for Large Text

**Status:** Awaiting verification  
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
* [x] Fix double-paste bug (Ctrl+V pasted text twice)
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

---

## Follow-up: double-paste bug (2026-08-17)

**Report:** every Ctrl+V paste into the terminal inserted the pasted text twice.

**Root cause:** the Ctrl+V branch in `attachCustomKeyEventHandler` (`AgentTerminal.jsx`)
returned `false` to tell xterm.js not to handle the keystroke itself, but never called
`event.preventDefault()`. Returning `false` only stops xterm's own key-processing — it
does not stop the browser's native paste action. Without `preventDefault()`, Ctrl+V still
fired the browser's native paste on xterm's underlying textarea, which xterm handles
internally and writes to the terminal via its normal `onData` path (paste #1). The
`pasteToTerminal()` call added in the chunking work above then read the clipboard a
second time and wrote it again (paste #2). The `paste` event listener added on the
container (to guard against exactly this) fires too late — xterm's own paste handling
lives on the textarea itself and runs during the target phase, before the event bubbles
up to the container's listener.

**Fix:** call `event.preventDefault()` in the Ctrl+V branch, before `return false`, so the
native paste event never fires and only the explicit `pasteToTerminal()` call runs.

**Verification:** Built a standalone harness (`@xterm/xterm` 6.0.0's real UMD bundle,
served locally, driven in an actual Chrome tab) that mirrors the exact handler code and
counts every write reaching the mock PTY. Set real OS clipboard content via
`Set-Clipboard`, then sent a genuine Ctrl+V keystroke (not a synthetic DOM event):
- **Before the fix:** one write arrived from xterm's own `onData` (the native paste path
  firing because `preventDefault()` was never called) — reproducing the mechanism live.
  Chrome's extension-sandboxed clipboard-read permission blocked the app's own
  `navigator.clipboard.readText()` call in this harness, so the second write couldn't be
  observed directly here, but the code path is identical to production and the missing
  `preventDefault()` is the confirmed, reproducible cause of the native path firing at all.
- **After the fix:** zero writes on the same real Ctrl+V keystroke — the native paste path
  is fully suppressed, leaving only the single deliberate `pasteToTerminal()` write (which
  does complete normally inside the real Electron app, unlike the sandboxed test tab).

Also confirmed `npm run build:renderer` and `npm test` (13/13) both pass. Live
verification inside the actual packaged/dev Electron app (real PTY, real clipboard
permissions) was not additionally performed this session.

---

## Follow-up: double-paste persisted (2026-08-22)

**Report:** Ctrl+V still inserted each clipboard payload twice in the real ACE
terminal.

**Root cause:** suppressing the keydown default was not a reliable ownership
boundary. xterm 6 registers native `paste` listeners on both its hidden textarea
and terminal element. ACE also performed a manual clipboard read/write. The
existing ACE `paste` listener was registered on the parent container in the
bubble phase, after xterm's target listener could already emit the same text
through `term.onData`.

**Fix:** Ctrl/Cmd+V now follows the native paste event only. ACE intercepts that
event on the parent in the capture phase, before either xterm listener, stops it,
and sends the event clipboard payload through the one chunk-aware writer.
Right-click remains a separate single manual read because ACE suppresses the OS
context menu. Both named listeners are removed during terminal cleanup.

**Regression coverage:** `terminal-paste.test.js` verifies event clipboard data
does not trigger a second clipboard read and that the non-event fallback reads
exactly once.

**Files modified:**

- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/utils/terminalPaste.mjs`
- `src/tests/terminal-paste.test.js`
- `CHANGELOG.md`
- `tickets/open/TICKET-0052.md`

**Automated verification:**

- `node --test tests/terminal-paste.test.js` — 2 passed
- `npm test` — 66 passed, 1 platform skip, 0 failed
- `npm run build` — renderer and main builds passed

Live verification in the real Electron terminal remains required before this
ticket can close, including small and large Ctrl/Cmd+V pastes and right-click.

## Closed

2026-08-29

