# TICKET-0149: Fix terminal image paste and Alt-click links

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-15

## Description

Image paste fails in Claude terminals and Alt-click does not open links.
Continue the existing uncommitted project-relative reveal fix without discarding it.
Related link interaction work: TICKET-0131.

## Implementation Plan

* [x] Pass the image captured by the paste event to main, validate and save it under the registered project; share keyboard and context-menu image insertion and report errors.
* [x] Route explicit terminal hyperlinks through ACE's shell bridge, with Alt-click and scheme validation. Correct relative file matching and surface failed reveals.
* [x] Add regression coverage, run the full tests and build, and update the changelog.

## Files Modified

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/utils/terminalPaste.mjs`
- `src/renderer/utils/terminalLinks.mjs`
- `src/tests/terminal-paste.test.js`
- `src/tests/terminal-links.test.js`
- `src/tests/audit-regressions.test.js`
- `docs/agents/architecture-guide.md`
- `CHANGELOG.md`

## Testing

- `npm test`: 105 passed, 1 POSIX-only test skipped, 0 failed.
- `npm run build`: renderer and main passed; existing large-chunk warning remains.
- Hidden Electron smoke test with the real sandboxed preload and registered IPC:
  renderer Uint8Array decoded to a real 1x1 PNG under a temporary registered
  project; relative paths and file URLs resolved; invalid image data rejected.
  Shell reveal was intercepted to avoid opening Explorer during the test.
- Live Claude keyboard/context-menu paste and physical Alt-click were not exercised.
  The application needs restarting from the rebuilt workspace for that check.

## Result

Keyboard and context-menu paste share captured image transfer and xterm paste
insertion. Save failures appear in operation feedback. Explicit terminal links
use ACE's shell bridge instead of blocked window.open; relative file detection
preserves the root segment and source locations. Alt-click cursor movement is
disabled and failed reveals are reported. Existing uncommitted changes were
preserved and extended.

## Notes

The original runtime image error was not supplied. The identified data-transfer and link-handling defects are fixed; provider-specific manual verification remains advisable.

## Closed

2026-09-15

