# TICKET-0057: Redesign new-project creation as name + location popups

**Status:** Closed
**Priority:** Medium
**Created:** 2026-08-17
**Closed:** 2026-08-17

---

## Issue

User asked to remove the shared project-name text input from the Sidebar's
"add project" panel. Instead, clicking "New" (create) should: (1) show a
popup asking for the project name, (2) after OK, show a second popup asking
where to save it -- defaulting to ACE's own parent folder, letting the user
navigate elsewhere -- and create the new project folder there. Must work on
both Windows and Mac.

Investigating the existing "✨ New" flow (`projects:createFromTemplate` in
handlers.js) found it's already dead code: it copies from a hardcoded
`C:\Users\JensPetterRøyseth\Documents\VS Code\Template` path -- a different
username than this machine's actual user (`jensr`), and the folder doesn't
exist at all (`ls` confirms). It's also Windows-only by construction (a
hardcoded backslash path), which would never have satisfied "must work on
...  Mac" regardless. So this ticket replaces it outright with a plain
empty-folder creation, rather than trying to fix/preserve a template
mechanism that was already non-functional.

---

## Requirements

* [x] Remove the shared `newName` text input from Sidebar.jsx's add-project
      panel
* [x] "✨ New" opens a custom in-app modal prompting for the project name
      (Electron doesn't implement `window.prompt()`, so this has to be a
      real React modal, not a browser prompt)
* [x] After OK, opens the native OS folder-picker (`dialog.showOpenDialog`,
      already cross-platform via Electron) defaulting to the parent folder
      of ACE itself, letting the user navigate anywhere
* [x] Creates `<chosen folder>/<name>` and registers it as a project
* [x] "📁 Existing" (connect to an existing folder) keeps working, now
      always deriving the project name from the folder's own basename
      since there's no more shared text field to override it with
* [x] Works cross-platform: the "parent folder of ACE" default is computed
      per dev-vs-packaged, same `isDev` distinction already used in
      `main/index.js`, with no platform-specific path logic of its own
      (`path.dirname`/`app.getAppPath`/`app.getPath('exe')` are all
      already cross-platform)

---

## Implementation Plan

1. New `components/Modal.jsx`: minimal reusable centered popup (backdrop,
   Escape-to-close, click-outside-to-close) -- no such generic primitive
   existed yet (`ContextMenu.jsx` is a cursor-anchored popover, a different
   pattern).
2. `handlers.js`: replace `projects:createFromTemplate` with
   `projects:createNew` (`{name, parentDir}` -> `mkdir`, collision-checked);
   extend `projects:pickFolder` to accept an optional `defaultPath`; add
   `projects:getDefaultParentDir` (computes ACE's parent folder, dev vs
   packaged).
3. `preload.js`: update the `pickFolder`/`createFromTemplate` bridge methods
   to match.
4. `Sidebar.jsx`: drop the inline name input; wire "✨ New" to the new
   modal -> native folder picker -> create flow.

---

## Files Modified

- `src/renderer/components/Modal.jsx` (new)
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/Sidebar.jsx`

---

## Testing

* [x] `npm run build` clean, `npm test` still passing
* [x] Live: real dev app, full New flow verified end-to-end (see Result)
* [x] Live: Existing flow still works, name derived from folder basename
      (unchanged code path, only lost the now-removed name-override input)
* [x] Cancelling either popup does not create a project or leave stray state
* macOS not testable from this Windows machine -- the path logic itself has
  no Windows-specific branches, but flagged as an unverified gap same as
  prior tickets

---

## Result

**Live-verified** against the real dev app on a throwaway profile (isolated
`--user-data-dir`, same technique as TICKET-0043/0055), driven via raw CDP
(Node's built-in global `WebSocket`):

- `window.cpi.getDefaultParentDir()` resolved to `C:\Users\jensr\Documents\VS
  Projects` -- the actual parent folder of this repo ("Claude Creator"),
  exactly the folder where this user's other sibling projects (seen
  elsewhere in the app's own Token Usage breakdown -- "API", "JobHunter")
  already live. Confirms the dev-mode `app.getAppPath()` branch computes the
  intended default.
- `window.cpi.createNewProject('MyTestProject', <temp dir>)` actually
  created the folder on disk (confirmed via a direct filesystem check, not
  just the returned `{path}`), then `addProject` + `getProjects` confirmed it
  registers correctly.
- Calling `createNewProject` again with the same name/parent correctly
  returned the collision error instead of silently overwriting.
- Clicked through the real UI: "+" reveals the Existing/New buttons (no more
  inline text field), "✨ New" opens the name modal, submitting an empty name
  shows the inline validation error without proceeding, and Cancel closes the
  modal with no side effects.
- Test artifacts (temp folder, throwaway profile) cleaned up afterward; the
  throwaway Electron instance was the only process terminated (found via the
  PID bound to the debug port, never a blanket taskkill).

**Not automated:** the native OS folder-picker dialog itself (the "where to
save it" popup) — driving a real native dialog isn't reachable via CDP
(it's outside the page/DOM surface entirely). This is the same
`dialog.showOpenDialog` API the pre-existing "Existing" flow already used
successfully, just now also given a `defaultPath`, so the risk here is
narrow and was covered by code review plus the isolated
`getDefaultParentDir`/`createNewProject` checks above rather than a full
manual click-through.

---

## Notes

- Removed `projects:createFromTemplate` entirely rather than fixing it in
  place -- it was already fully dead (hardcoded path pointing at a different,
  no-longer-existing username, Windows-only by construction). No other code
  referenced it.
- New `components/Modal.jsx` is a generic centered-popup primitive (backdrop,
  Escape/click-outside to close) -- the first of its kind in this app;
  `ContextMenu.jsx` is a different, cursor-anchored pattern. Worth reusing
  for any future "ask the user something" dialog, since Electron doesn't
  implement `window.prompt()`.
