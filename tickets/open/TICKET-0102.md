# TICKET-0102 — macOS Agent terminal: Cmd+C copy broken and intro line racily wiped

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-08-25

---

## Description

Two Agents-screen bugs reproduce on macOS but not on Windows:

1. **Copy/paste broken.** Selecting text in an agent terminal and pressing
   Cmd+C does not copy it, so there is nothing to paste out afterwards.
2. **"Welcome to Claude Code" box missing.** The CLI's Welcome box (cwd, model,
   tips) never appears on macOS launch (lower UX impact, cosmetic). Confirmed
   with the user: they want the Welcome box kept.

---

## Reason

1. `AgentTerminal.jsx`'s `attachCustomKeyEventHandler` copy branch only tested
   `event.ctrlKey`. macOS copy is Cmd+C (`event.metaKey`), so the copy branch
   never ran there. On macOS Ctrl+C must still pass through as SIGINT, so the
   copy modifier has to be platform-selected (`metaKey` on darwin, `ctrlKey`
   elsewhere), not simply OR-ed. The paste branch already accepted `metaKey`,
   which is why paste-in worked but copy-out did not.
2. The launch wipe (`term.clear()` at `LAUNCH_BANNER_HIDE_MS`, TICKET-0025)
   keeps only the current line and discards everything above it. macOS spawns
   the CLI through a login shell and renders slower, so the wipe landed on the
   fully-rendered Welcome box and removed it, while Windows' timing left the box
   as (or near) the current line so it survived. Per user decision the Welcome
   box is kept, so the reveal no longer clears the screen; the loading overlay
   alone masks boot churn.

---

## Implementation Plan

* [x] Platform-select the copy modifier in `AgentTerminal.jsx` (Cmd on macOS,
  Ctrl elsewhere) so Cmd+C copies a selection while Ctrl+C stays SIGINT on mac.
* [x] Stop clearing the screen on launch reveal so the Welcome box survives on
  both platforms; keep the loading overlay to mask boot churn. Delay stays
  platform-aware (longer on macOS) so the overlay lifts after the box renders.
* [x] Live-verified copy/paste on macOS (user-confirmed): Cmd+C copies a
  selection, paste works, Ctrl+C still interrupts.
* [ ] Live-verify on macOS: Welcome box now visible after launch.
* [x] 2026-09-01: re-applied both code changes — the original edits were never
  committed and were gone from the working tree (only this ticket file
  survived, untracked), so the user hit the Cmd+C bug again.

---

## Files Modified

- `src/renderer/components/AgentTerminal.jsx`
- `CHANGELOG.md`

---

## Testing

`npm test` from `src/` (regression). The behaviour itself is manual/live: the
copy path depends on real key events and the OS clipboard, and the splash
timing depends on real CLI startup, neither of which the unit suite exercises.

---

## Result

Copy modifier is now platform-correct (verified live on macOS). The launch
reveal no longer clears the screen, so the Welcome box is preserved on both
platforms; this reverses TICKET-0025's screen-wipe per user decision. The
Welcome-box change awaits a live macOS check, hence Awaiting verification.

**2026-09-01 — re-applied.** The change described above was lost: it never
reached a commit and no longer existed in the working tree (`git log` for
`AgentTerminal.jsx` ends at TICKET-0052 / a "Quick commit from ACE"), so the
shipped code was still the Ctrl+C-only, screen-wiping version and the user
reported the copy bug again. Both edits are back in
`AgentTerminal.jsx`: platform-selected copy modifier (`window.ace.platform ===
'darwin'` → `metaKey`, else `ctrlKey`), guarded to `keydown` only so one
keypress writes the clipboard once, and the `term.clear()` dropped from the
reveal with `LAUNCH_BANNER_HIDE_MS` now 2000ms on macOS / 1200ms elsewhere.
`npm test` 66/66, `npm run build` clean. Both live checks are open again on
this re-applied code.

---

## Notes

Keeps the TICKET-0025 splash-hiding behaviour; only its timing is tuned per
platform. `window.ace.platform` (`preload.js`) is the existing platform signal,
already used by `FileTree.jsx`.

---

## Closed

