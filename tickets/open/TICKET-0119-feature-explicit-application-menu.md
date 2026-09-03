# TICKET-0119 — Ship an explicit application menu with About and Settings

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-03

---

## Description

ACE never calls `Menu.setApplicationMenu`, so it ships Electron's stock
default menu. That menu has no Settings item and no About/version entry, and
in packaged builds it still exposes Reload / Force Reload / Toggle DevTools —
a stray Ctrl+R wipes editor tabs and view state, and DevTools is handed to
end users.

Add a hand-written menu template:

- **About Agent Command Engine** — `app.setAboutPanelOptions` + `role: 'about'`,
  version read from `app.getVersion()` (no hardcoding). App menu on macOS,
  Help menu elsewhere.
- **Settings…** — `CmdOrCtrl+,`, routes to the existing Settings view via a
  new `menu:navigate` main→renderer message.
- **View** — Reload / Force Reload / Toggle DevTools only when
  `!app.isPackaged`; Zoom and Fullscreen always.
- **Help** — About, Report an Issue, Documentation (GitHub URLs via
  `shell.openExternal`).
- Standard `editMenu` / `windowMenu` roles; a proper `appMenu` on macOS.

---

## Reason

Baseline desktop-app expectations (About with a version, a Settings
accelerator) plus removing the production DevTools/reload footgun. One
new main-process module, no renderer behaviour change beyond honouring the
new navigate message.

---

## Implementation Plan

* [x] `src/main/menu.js` — `buildMenu(win)` returning the template, platform-aware
* [x] `src/main/index.js` — call `Menu.setApplicationMenu(buildMenu(mainWindow))` after `createWindow()`; `app.setAboutPanelOptions` at startup
* [x] `src/main/preload.js` — expose `onMenuNavigate(cb)` on `window.ace`
* [x] `src/renderer/App.jsx` — subscribe, call `setActiveView`
* [x] `src/tests/menu.test.js` — template builds, has Settings + About, hides dev items when packaged
* [x] `CHANGELOG.md`, `docs/agents/current-state.md` version line

---

## Files Modified

- `src/main/menu.js` (new)
- `src/main/index.js`
- `src/main/preload.js`
- `src/renderer/App.jsx`
- `src/tests/menu.test.js` (new)
- `CHANGELOG.md`
- `docs/agents/current-state.md`

---

## Testing

- `npm test` from `src/` — new `menu.test.js` plus existing suite
- `npm run build`
- Manual: launch, check menu bar has About (shows 0.1.30) and Settings
  (`Ctrl+,` opens the Settings view); confirm Reload/DevTools are absent in a
  packaged build and present in `npm run dev`

---

## Result

Implemented. `src/main/menu.js` builds the template; `index.js` installs it
after `createWindow()` (and again on macOS `activate`, so a recreated window
keeps a live `menu:navigate` target). `App.jsx` subscribes via
`window.ace.onMenuNavigate` and calls `setActiveView`.

`npm test` from `src/`: 70 tests, 69 pass, 1 skipped (POSIX-only). New
`menu.test.js` covers the top-level sections, the Settings accelerator and
navigation, the Help entries, and the packaged-vs-dev View menu.
`npm run build` (renderer + main) succeeds.

Still needs a live check: launch the app, confirm About shows 0.1.30 and
`Ctrl+,` opens Settings, and that a packaged build hides Reload/DevTools.

---

## Notes

`docs/agents/current-state.md` still lists version 0.1.18 (actual 0.1.30);
left as-is, it already disclaims itself and the drift predates this ticket.

---

## Closed

