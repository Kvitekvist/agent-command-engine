# TICKET-0034

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-09

---

## Description

Rework the screenshot feature (TICKET-0032) from a clipboard-paste model to
an interactive drag-to-select screen capture:

- The 📸 button on a running agent's card now triggers a screen capture
  overlay the user can drag a rectangle across (like the Windows Snipping
  Tool), instead of reading whatever image happens to already be on the OS
  clipboard.
- The captured region is saved into the **active project's own folder**
  (`.cpi/screenshots/`), not Electron's `userData` directory — one shared
  folder for the project, not split per agent.
- The project's `.gitignore` is auto-updated (created if missing) so
  `.cpi/` never gets committed to the user's repo.
- v1 captures the **primary display only** (no multi-monitor drag-select).

---

## Reason

User feedback after TICKET-0032 shipped: clipboard-paste required a
separate screenshot tool to already be running and left files under
`userData`, disconnected from the project. Direct in-app region capture is
one step instead of two, and keeping the files inside the project makes
sense now that they're meant to be referenced by prompts run with that
project as cwd.

---

## Implementation Plan

* [x] Replace `ScreenshotService.pasteFromClipboard` with
      `captureRegion(projectPath)`: grab the primary display via
      `desktopCapturer`, hand it to a selection overlay, crop to the
      selected rect, save under `<project>/.cpi/screenshots/`,
      auto-append `.cpi/` to the project's `.gitignore`, copy the saved
      file's path (relative to the project root) to the clipboard.
      Originally hid the main window first — reverted (see Result below):
      the user needs to be able to screenshot CPI itself (e.g. an agent's
      terminal), which auto-hiding made impossible
* [x] Build the selection overlay: a frameless/transparent/always-on-top
      `BrowserWindow` sized to the primary display, showing the captured
      frame with a drag-to-select rectangle (Esc or right-click to cancel)
* [x] Remove the old per-agent folder logic (`folderFor(agentId)`,
      `deleteFolder`) — screenshots are project-scoped now, so
      `agents:delete` no longer needs to clean anything up
* [x] Rewire `screenshots:pasteFromClipboard` (IPC + preload) to
      `screenshots:captureRegion(projectPath)`
* [x] Update the 📸 button (`AgentView.jsx`) to call the new capture path
      and reflect cancel/error/success in the existing toast (was checked
      off already implemented, but the button's `onClick` still referenced
      the old `pasteScreenshot` handler — see Result)
* [ ] Manual verification: click 📸 on a real running agent, drag-select a
      region — including a region that covers CPI's own window, to confirm
      it's actually capturable — confirm the PNG lands under
      `<project>/.cpi/screenshots/`, confirm `.gitignore` gained a `.cpi/`
      entry, confirm Esc/right-click cancels cleanly, confirm the copied
      clipboard path pastes correctly into the agent's terminal

---

## Files Modified

- src/main/services/ScreenshotService.js (rewritten)
- src/main/overlay/screenshot-overlay.html (new)
- src/main/overlay/screenshot-overlay.js (new)
- src/main/overlay/screenshot-overlay-preload.js (new)
- src/main/ipc/handlers.js
- src/main/preload.js
- src/renderer/views/AgentView.jsx

---

## Testing

`npm run build:renderer` and `npm run build:main` (both clean), `npm test`
(11/11 pass, pre-existing — no automated coverage for this UI/IPC feature).
Vite's build does not catch an undefined-variable reference inside JSX
(it's only a runtime `ReferenceError`, not a build-time error), which is
how the bug below shipped past a "clean build" once already.

---

## Result

Found and fixed a crash bug in this ticket's own not-yet-verified work:
the 📸 button's `onClick` still called `pasteScreenshot`, a function that
was never defined in `AgentView.jsx` — a leftover name from TICKET-0032's
superseded clipboard-paste design. `captureScreenshot` (the actual,
correctly-wired capture-region handler this ticket added) was defined but
never called from anywhere. Since CPI's renderer has no error boundary,
this `ReferenceError` during render crashed the whole React tree — visible
to the user as the entire app going blank the moment the Agents tab
rendered a card for any running agent (reported live: "clicking on the
agents tab now makes the app go blank"). Fixed by pointing the button at
`captureScreenshot`, disabling it and swapping the icon for `…` while
`capturing` is true, and correcting its title text (still described the
old clipboard-paste behavior). The manual-verification checklist item
above is unblocked by this fix but still not run.

Second bug reported live, also fixed: `ScreenshotService.captureRegion`
called `win.hide()` on CPI's own main window before every capture (showing
it again in a `finally` block once the crop/save finished). Intended
reasoning isn't documented anywhere in this ticket, but the effect was
that CPI itself could never be part of a screenshot — directly blocking
the feature's own stated purpose (this ticket's Description and the
original wishlist entry both call out "visual UI debugging/feedback" on
the app itself as a use case) and reported live as "when i click the
screenshot button the app hides, that cant happen because sometimes i
need to screenshot the app." Removed the hide/show entirely (and the
now-dead `mainWindow` field/`setWindow()` method it existed only to
support, plus its call site in `handlers.js`) — `captureRegion` now grabs
whatever's actually on screen, CPI included, matching how every standard
screen-capture tool (Snipping Tool, Greenshot) behaves. If the user wants
to capture something else instead, they can move or minimize CPI first,
same as with those tools. Verified via a clean `npm run build:main` and
the full automated test suite (11/11 pass, no new coverage — this is
native Electron window/capture behavior, not something the Node test
runner exercises).

---

## Notes

Supersedes TICKET-0032's clipboard-paste approach — that ticket stays
closed as-shipped-then-superseded rather than reopened, since the
clipboard-clobber bug it fixed (toast text stomping the clipboard) is
still relevant and was carried forward into this rework's toast too.

---

## Closed
