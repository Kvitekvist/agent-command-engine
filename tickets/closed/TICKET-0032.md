# TICKET-0032

**Status**

Closed

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-09

---

## Description

Give each agent a dedicated screenshot folder, plus a button that pastes
an image from the clipboard directly into that folder, so the running
`claude`/`codex` CLI process can read screenshots straight from disk (for
visual debugging / UI feedback) without the user manually saving files
and typing out a path.

---

## Reason

Promoted from `WISHLIST.md` item 2. No screenshot handling, clipboard
access, or per-agent folder scaffolding currently exists anywhere in the
codebase.

---

## Implementation Plan

* [ ] Decide the per-agent folder location/naming (e.g. under the
      project's working directory, or a CPI-managed temp/data dir keyed by
      agent id) and whether it needs cleanup on agent delete/app quit
* [ ] Add a main-process IPC handler that reads an image from the OS
      clipboard and writes it into the agent's folder (timestamped
      filename), following the same path-containment posture as
      `FileService.resolveWithinRoot` (TICKET-0021)
* [ ] Expose `window.cpi.screenshots.pasteFromClipboard(agentId)` (or
      similar) via `preload.js`
* [ ] Add a button to each agent's chat card wired to the new IPC call,
      with visible feedback (e.g. toast/inline message) on success/failure
      (including "clipboard has no image" case)
* [x] Manual verification: copy an image to clipboard, click paste on a
      real running agent, confirm the file lands in the correct
      per-agent folder and the agent can read it back via a prompt

---

## Files Modified

- src/main/services/ScreenshotService.js (new)
- src/main/ipc/handlers.js
- src/main/preload.js
- src/renderer/views/AgentView.jsx

---

## Testing

Live, on a real running agent (this agent, "Yuki", project "Claude
Creator"): clicked 📸, confirmed via direct filesystem read that the PNG
landed at `%APPDATA%/claude-projects-interface/screenshots/<agentId>/
screenshot-<iso>.png`. Read the file back directly by path and confirmed
it's a real screenshot (of the CPI app itself).

Bug found during this pass: checked the live OS clipboard right after a
successful save and found it held the toast's own UI text instead of the
file path the button had just written. Root cause: the toast message
(`text-xs ... shrink-0 truncate`) was ordinary selectable text, and its
own wording ("path copied") invited selecting/copying *that line* as if
it were the path — silently overwriting the real clipboard content the
button had just set, right before the user's next paste. Fixed by adding
`select-none` to the toast so it can no longer be selected/copied over
the real clipboard content.

---

## Result

Implemented and the clipboard-clobber bug fixed. Folder-per-agent
scaffolding, IPC plumbing, and the paste button all work as designed —
confirmed by finding a real saved screenshot on disk and reading it back
directly. The only failure mode found (toast text overwriting the
clipboard when selected/copied) is now prevented at the UI level.

---

## Notes

Discovered while debugging a user report of "it's not working": the
write side (save PNG + `clipboard.writeText(path)`) was correct the
whole time -- the failure was a UX trap in the success toast, not the
IPC/service code. Worth remembering as a general pattern: any feature
that hands something off via the OS clipboard for the user to paste
elsewhere should make its own status text non-selectable, since a
visible "copied" message right next to the thing you want to paste is a
natural (and destructive) target for an accidental copy.

---

## Closed

2026-08-09
