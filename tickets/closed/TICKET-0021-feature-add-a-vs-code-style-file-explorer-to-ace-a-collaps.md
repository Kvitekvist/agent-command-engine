# TICKET-0021 — Add a VS Code-style file explorer to ACE: a collapsible file tree

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

Add a VS Code-style file explorer to ACE: a collapsible file tree in the
Sidebar, scoped to the active project, that lets the user click a file to
open it in a real code editor (Monaco — the same editor VS Code itself
uses) and save changes directly back to disk.

Scoped with the user via three questions before implementation:
1. **Placement** — a persistent tree in the Sidebar (not per-agent), with
   opened files rendered in their own editor area.
2. **Editor depth** — a real Monaco editor (syntax highlighting, multi-
   language), not a plain textarea.
3. **Save behavior** — independent Ctrl+S/Save button that writes straight
   to disk via a new IPC call, same as any other editor. Not routed
   through an agent prompt.

---

## Reason

User asked for this directly: "i need a file explorer similar to VS Code
or something per project. So i can click on files, expand folders and
edit." ACE already manages arbitrary project folders and already grants
agents read/write access to them (via the embedded terminal, TICKET-0019)
— a file explorer/editor for the human using ACE is the same trust
boundary, just a more direct path to it.

---

## Implementation Plan

* [ ] Add `fs:readDir` / `fs:readFile` / `fs:writeFile` IPC handlers in
      `src/main/ipc/handlers.js`. Every call resolves the requested path
      and rejects it if it falls outside the requesting project's root
      (defense in depth against a path-traversal request, even though the
      renderer is our own code — same posture as not trusting any other
      IPC input blindly)
* [ ] Expose `window.cpi.fs.{readDir,readFile,writeFile}` in `preload.js`
* [ ] Add `monaco-editor` + `@monaco-editor/react` + a Vite plugin for
      bundling Monaco's web workers locally (offline-friendly — no CDN
      fetch — matching how every other dependency in this Electron app is
      bundled, not loaded remotely)
* [ ] Add `src/renderer/components/FileTree.jsx` — collapsible tree,
      lazy-loads a directory's children only when expanded (not an eager
      full-project walk — avoids choking on large `node_modules` trees)
* [ ] Wire `FileTree` into `Sidebar.jsx`, scoped to `activeProject`
* [ ] Add `src/renderer/views/EditorView.jsx` — tab strip of open files +
      a Monaco instance for the active tab, dirty-state indicator,
      Ctrl+S/Save button wired to `window.cpi.fs.writeFile`
* [ ] Extend the zustand store: `openFiles`/`activeFile` + open/close/
      edit/save actions; add `'editor'` to `activeView`
* [ ] Wire `App.jsx` to render `EditorView` when `activeView === 'editor'`;
      clicking a file in the tree opens it and switches to that view
* [x] Manual verification, driven live over the Chrome DevTools Protocol
      (same technique used for TICKET-0019/0020, since Playwright isn't in
      this repo): selected a real project, expanded its tree, clicked
      `AGENTS.md`, confirmed a real `.monaco-editor` rendered with correct
      line numbers and the file's actual content, no console errors.
      Separately exercised `window.cpi.fs.writeFile`/`readFile` directly
      against a disposable test file inside that same project (write →
      read-back matched, then deleted) and confirmed a `..` path-traversal
      attempt is correctly rejected (`"Path is outside the project root"`)
      rather than silently escaping the project root
* [ ] Still open: driving an actual edit + Save through Monaco's own
      keyboard input (verified the write path directly instead, not via
      simulated Monaco typing), opening two files and confirming tab
      switching preserves independent undo history, and a large/binary
      file specifically (the `MAX_READABLE_BYTES`/`looksBinary` guards in
      `FileService.js` are implemented but not yet exercised against a
      real large/binary file in a live run)

---

## Files Modified

- src/package.json / src/package-lock.json (`@monaco-editor/react`, `monaco-editor`, `vite-plugin-monaco-editor-esm`)
- src/vite.renderer.config.mjs
- src/main/services/FileService.js (new)
- src/main/ipc/handlers.js
- src/main/preload.js
- src/renderer/components/FileTree.jsx (new)
- src/renderer/components/Sidebar.jsx
- src/renderer/views/EditorView.jsx (new)
- src/renderer/App.jsx
- src/renderer/store/useStore.js

---

## Testing

`npm run build:renderer` / `npm run build:main` both pass; manual
verification via live CDP automation — see checklist above for exactly
what was and wasn't exercised.

---

## Result

Implemented and verified end-to-end for the read path (tree → open → real
Monaco rendering) and the write/security path (writeFile/readFile round
trip, path-traversal rejection), both against a real project on this
machine. Two Vite/Monaco integration bugs had to be worked around along
the way — see Notes. Tab switching, an actual Save via simulated Monaco
keystrokes, and large/binary file handling are implemented but not yet
individually exercised in a live run — left open above rather than
assumed working.

---

## Notes

**Two real bugs hit wiring Monaco into this Vite setup, both worked
around rather than reported upstream (out of scope here):**
1. `monaco-editor@0.56.0` (latest at the time) ships a package.json
   `exports` map (`"./*": "./esm/vs/*.js"`) that `vite-plugin-monaco-
   editor-esm@1.1.0`'s hardcoded worker subpath strings (which already
   include `esm/vs/...`) don't expect, producing a doubled
   `esm/vs/esm/vs/...` path that fails to resolve at build time. Fixed by
   pinning `monaco-editor@0.50.0`, an older version without that `exports`
   map, matching what the plugin was actually built against.
2. The plugin computes its output directory as `path.join(root,
   build.outDir, ...)`, which assumes `outDir` is root-relative. This
   repo's `vite.renderer.config.mjs` originally set `outDir` to an
   absolute path (`path.join(__dirname, 'dist/renderer')`) for clarity,
   which `path.join` doesn't special-case the way `path.resolve` would --
   it just concatenates both into a nonsensical nested path. Fixed by
   switching `outDir` to a relative path (`'../dist/renderer'`, resolved
   against `root` the same way Vite always resolves a relative `outDir`)
   instead of fighting the plugin's internals with a `customDistPath`
   override -- same final absolute output location either way, just
   compatible with how the plugin computes it.

**Chose `@monaco-editor/react` + `vite-plugin-monaco-editor-esm` + a
pinned `monaco-editor` version** over hand-rolling worker `Blob`/
`importScripts` wiring myself -- more moving parts to get right initially
(see bugs above), but the alternative is maintaining Monaco's own worker
loading logic by hand indefinitely, which is worse long-term. `loader.
config({ monaco })` in `EditorView.jsx` is what makes `@monaco-editor/
react`'s `<Editor>` use this locally-bundled `monaco-editor` instead of
its default CDN-fetch behavior.

**File explorer/editor uses the same trust boundary ACE already has**,
not a new one: agents (via TICKET-0019's embedded terminal) already get
read/write access to a project's folder depending on permission mode; a
human directly editing files through Sidebar's tree is the same access,
just more direct. `FileService.resolveWithinRoot`'s containment check is
defense in depth against a malformed request, not a new security boundary
being introduced.

---

## Closed

2026-08-29

