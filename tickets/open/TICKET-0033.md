# TICKET-0033

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

Add a right-click context menu to files in the Sidebar's file explorer
tree (`FileTree.jsx`, TICKET-0021) with:

- **Open** — same as the existing left-click behavior (opens in the
  Monaco editor)
- **Open in Explorer** — reveal the file in Windows File Explorer
- **Run** — shown only for executable-like files (`.bat`, `.exe`, etc.)

---

## Reason

Promoted from `WISHLIST.md` item 3. `FileTree.jsx` currently only
supports left-click-to-open; there is no context menu of any kind.

---

## Implementation Plan

* [x] Add a reusable context-menu component (position-at-cursor, closes on
      outside click/Escape) since none currently exists in
      `src/renderer/components/`
* [x] Wire a right-click handler on each file row in `FileTree.jsx` that
      opens the menu with the clicked file's path
* [x] **Open** — reuse the existing click-to-open-in-Monaco path
* [x] **Open in Explorer** — new main-process IPC handler using Electron's
      `shell.showItemInFolder`, exposed via `preload.js`
* [x] **Run** — new main-process IPC handler that spawns the file (e.g.
      via `shell.openPath` or a direct `child_process.spawn`, `windowsHide`
      considerations per TICKET-0029's lesson on vendor spawns), gated to
      an allowlist of executable-like extensions (`.bat`, `.exe`, `.cmd`,
      etc.) and only rendered in the menu for matching files
* [ ] Manual verification: right-click a regular file (Open, Open in
      Explorer only), right-click a `.bat`/`.exe` (Run also present and
      working), confirm Explorer actually opens/highlights the file and
      Run actually launches it

---

## Files Modified

- src/renderer/components/ContextMenu.jsx (new)
- src/renderer/components/FileTree.jsx
- src/main/services/FileService.js
- src/main/ipc/handlers.js
- src/main/preload.js

---

## Testing

`npm run build` (renderer + main, both clean) and `npm test` (11/11 pass,
no new coverage — this is IPC/UI wiring and native process spawning, same
reasoning as TICKET-0021/0025/0027 etc., which also shipped without new
automated coverage for comparable UI/native-process behavior).

---

## Result

Implemented as scoped. `FileTree.jsx`'s right-click handler suppresses the
browser's own context menu on every row but only opens the custom
`ContextMenu` for files, not directories (directories keep left-click-to-
expand only — matches the ticket's own framing of this as a file-row
feature). `Run`'s extension allowlist
(`.exe/.bat/.cmd/.ps1/.vbs/.com/.msi`) is duplicated by hand in
`FileTree.jsx` (menu gating) and `FileService.js` (the real authority,
re-checked server-side so a stale renderer copy can never widen what's
actually runnable) — flagged in both places with a comment pointing at
the other.

`.ps1` needed a special case: Windows' default double-click verb for a
PowerShell script is "Edit" (opens in an editor), not "Run" — a
deliberate OS security default — so relying on `shell.openPath`/file-
association alone would silently fail to execute it. `runFile` spawns
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File <target>`
directly for that extension instead; every other allowlisted extension is
spawned via the file itself (`shell:true` for anything that isn't a raw
`.exe`, so Windows resolves `.bat`/`.cmd`/`.vbs`/`.com`/`.msi` through
`cmd.exe`'s own association handling).

Manual verification (right-click behavior against a real running app
window, confirming Explorer actually opens/highlights and Run actually
launches something visible) is still open — this needs an actual app
restart, since `handlers.js`/`preload.js` are main-process files and this
session's dev window, per architecture.md's `npm run dev` gotcha, only
hot-reloads the renderer. Deferred rather than forced, same reasoning as
TICKET-0024/0025/0026/etc.: the user's running dev window may have
in-progress agent sessions that a restart would end.

---

## Notes

`Run` is intentionally *not* `windowsHide`'d, unlike this app's own
background spawns (TICKET-0029's tokscale fix) — a user-invoked Run
should behave like an actual double-click in Explorer, console window and
all, not be silently hidden. That distinction (background/internal spawn
vs. user-invoked/visible spawn) is worth remembering for any future
spawn site in this app.

---

## Closed
