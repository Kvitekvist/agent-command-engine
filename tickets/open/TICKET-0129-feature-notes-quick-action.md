# TICKET-0129 — Add a Notes quick action to the agent terminal

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-13

---

## Description

Add a "Notes" icon to the terminal quick-actions row. Clicking it opens a
panel for writing free-form, multi-line reminders/summaries. Notes are
shared by every agent in the project (stored in the project itself, not
per-agent), and each note has a "Send to chat" button that pastes its text
into that terminal's input. Agents must also be able to write notes
themselves, using their own file-editing tools.

---

## Reason

Requested by the user: a lightweight, always-available scratch space for
reminders/summaries that any agent working on the project can read or add
to, without a dedicated chat round-trip.

---

## Implementation Plan

### Audit continuation, 2026-09-14

Follow up shared Notes through TICKET-0134 rather than reimplementing the original toolbar feature.

* [x] Store notes as one plain-text file per project (`.ace/notes.txt`),
      timestamp + free-form body, `\n---\n`-delimited, so an agent's own
      file tools can append a note with a plain write/append, no dedicated
      IPC or JSON needed (`src/renderer/utils/notes.mjs`).
* [x] `NotesPanel` component: textarea to add a note, reverse-chronological
      list, delete, and "Send to chat" per note. Reuses the existing generic
      `window.ace.fs.readFile` / `writeFile` IPC and `Modal` component — no
      new IPC surface.
* [x] Wire a "📝 Notes" button into `AgentTerminal`'s quick-actions row;
      "Send to chat" reuses the existing `pasteToTerminal` helper so
      multi-line notes land in the terminal the same way a real clipboard
      paste does.
* [x] Unit tests for `parseNotes`/`serializeNotes` round-tripping.
* [x] Fixed-size panel (`h-[32rem] flex flex-col` via `Modal`'s new
      `className` prop) with the note list scrolling in the remaining space,
      instead of the modal growing with the note count.
* [x] Red ✕ close button added to `Modal` itself (top-right), so every modal
      gets it, not just this one.

---

## Files Modified

Audit continuation: NotesPanel.jsx, NotesService.js, notes.mjs, App.jsx, Sidebar.jsx, preload.js and handlers.js.

* `src/renderer/utils/notes.mjs` (new)
* `src/renderer/components/NotesPanel.jsx` (new)
* `src/tests/notes.test.js` (new)
* `src/renderer/components/AgentTerminal.jsx`
* `src/renderer/components/Modal.jsx` (fixed-size `className` prop, ✕ close button)

---

## Testing

Audit continuation: Main merge/format tests and hidden Electron missing-file, failed/delayed-write/add checks pass. Search/edit/undo exist; real provider safe insertion remains.

* `npm test` (src/tests/notes.test.js)

---

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.



---

## Notes

Notes live at `.ace/notes.txt` in the project root, so they're visible to
every agent (and every terminal) working on that project, and to an agent's
own file-read/write tools directly.

---

## Closed
