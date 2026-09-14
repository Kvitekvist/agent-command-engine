# TICKET-0130 — fs:readFile/writeFile silently fail on a root-relative path

**Status**

Open

**Type**

Bug

**Priority**

High

**Created**

2026-09-13

---

## Description

Reported symptom: adding a note in the Notes panel (TICKET-0129), closing
the window and reopening it lost the note.

Root cause: `FileService.resolveWithinRoot(root, target)` resolved `target`
with `path.resolve(target)` alone -- for an absolute `target` (every
`FileTree`/`EditorView` call site) this "worked" by accident, but for a
root-relative `target` (`NotesPanel`'s `.ace/notes.txt`, and
`AgentTerminal`'s own build-capability check reading `src/package.json`) it
resolved against the *main process's* cwd instead of the project root,
almost always landing outside the root and throwing `Path is outside the
project root`. `fs:writeFile`'s handler catches that and returns
`{ ok: false, error }`, which `NotesPanel.persist()` never checked -- so the
write silently no-opped and the next open re-read the (unchanged) file from
disk.

---

## Reason

Two existing call sites already assumed relative-path support
(`AgentTerminal.jsx`'s `checkBuildCapability`, silently swallowing the same
failure via `res?.ok ? res.content : null`); `NotesPanel.jsx` just made the
failure visible for the first time.

---

## Implementation Plan

* [x] `resolveWithinRoot` now resolves with `path.resolve(root, target)`,
      which joins a relative target onto root while leaving an absolute
      target (FileTree's case) untouched -- one fix serves both callers.
* [x] Regression test: relative-path `writeFile`/`readFile` round-trip
      (`src/tests/file-service.test.js`).

---

## Files Modified

* `src/main/services/FileService.js`
* `src/tests/file-service.test.js`

---

## Testing

* `npm test` (src/tests/file-service.test.js, including the existing
  path-escape/sibling-directory security tests, which still pass)

---

## Result



---

## Notes



---

## Closed

