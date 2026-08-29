# TICKET-0069

**Status**

Closed

**Type**

Bug

**Priority**

Medium

**Created**

2026-08-21

---

## Description

The app icon has been replaced by the default Electron icon on macOS (dock
icon and packaged app bundle icon). The custom ACE icon never shows.

---

## Reason

Two stacked causes:

1. **`build/icon.icns` was never present in the repo.** Both the packaging
   config (`src/package.json` `build.mac.icon` → `../build/icon.icns`) and
   the runtime window (`src/main/index.js` `getIconPath()` for darwin)
   point at `build/icon.icns`, but that file was never generated or
   committed — only the Windows `icon.ico` and the source `icon.iconset/`
   PNGs exist. With no `.icns`, electron-builder and the BrowserWindow fall
   back to the default Electron icon on macOS.

2. **`.gitignore` never allow-listed the icns.** `/build/*` is ignored with
   explicit un-ignores for `icon.ico`, `icon.iconset/`, `README.md`, and
   `.gitkeep` — but not `icon.icns`. So even after generating it (e.g. via
   the existing `scripts/create-icns-on-mac.sh`), it could never be
   committed, which is why it stayed absent on every macOS build. The
   project was developed primarily on Windows, where the `.ico` was tracked
   and the missing `.icns` went unnoticed.

---

## Implementation Plan

* [x] Generate `build/icon.icns` from the existing `build/icon.iconset/`
  (`scripts/create-icns-on-mac.sh` → `iconutil -c icns`).
* [x] Allow-list `!/build/icon.icns` in `.gitignore` so it is tracked.
* [x] Set the macOS dock icon at runtime in dev (`app.dock.setIcon()`), since
  unpackaged runs have no bundle and macOS ignores `BrowserWindow.icon`.

---

## Files Modified

- .gitignore (allow-list `build/icon.icns`)
- build/icon.icns (new, generated from the iconset — 1.2 MB, valid
  `Mac OS X icon` file)
- src/main/index.js (`setDevDockIcon()` — dev-only macOS dock icon)

---

## Testing

- `iconutil -c icns build/icon.iconset -o build/icon.icns` produced a valid
  file (`file build/icon.icns` → `Mac OS X icon`).
- `git check-ignore build/icon.icns` now reports the file as tracked (no
  longer ignored).
- `npm test` (43 tests) still passes — no code paths changed, only an asset
  and ignore rule.

Full packaged-app dock-icon verification requires a `dmg`/portable build on
macOS (`npm run package`), same GUI-launch caveat as prior release tickets;
the asset and config are now in place for it.

---

## Result

`build/icon.icns` now exists and is tracked. The macOS packaged app bundle
resolves the real ACE icon instead of the Electron default — confirmed live:
the freshly-built `Agent Command Engine.app` embeds our exact `icon.icns`
(md5 match) with `Info.plist` `CFBundleIconFile = icon.icns`, and the user
confirmed the dmg shows the correct icon.

Follow-up: the user then noted `npm run dev` still showed the default
Electron icon. That's expected — an unpackaged dev run has no `.app` bundle
for the OS to read an icon from, and macOS ignores `BrowserWindow`'s `icon`
option. Fixed by `setDevDockIcon()` in `index.js`, which calls
`app.dock.setIcon()` with `build/icon.iconset/icon_512x512.png` on macOS in
dev only (no-op when packaged or off macOS). Windows (`icon.ico`) was always
fine and is unchanged.

---

## Notes

The iconset already contained every size `iconutil` requires. Regenerate
the icns via `scripts/create-icns-on-mac.sh` (macOS, uses `iconutil`) or
`scripts/create-icns.js` (cross-platform fallback via `png2icons`) if the
source artwork changes.

---

## Closed

2026-08-21
