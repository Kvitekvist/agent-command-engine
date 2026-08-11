# TICKET-0040

**Status**

Closed

**Type**

Feature

**Priority**

Low

**Created**

2026-08-11

---

## Description

Build the v0.1.2 Windows release artifacts (portable exe + NSIS installer) and
name the intermediate unpacked "portable" application folder `Portable-ACE`
instead of electron-builder's default `win-unpacked`.

---

## Reason

After pulling v0.1.2 there were no built binaries on this machine (release
binaries are not committed to the repo — only the git tag exists). The user
wants the copy-anywhere portable folder to have a clear, product-branded name
(`Portable-ACE`) rather than the generic `win-unpacked`, and wants that naming
to be the standard output of every build, not a one-off manual rename.

---

## Implementation Plan

* [x] Add electron-builder `afterAllArtifactBuild` hook
      (`src/build/afterAllArtifactBuild.js`) that renames the emitted
      `win-unpacked` folder to `Portable-ACE` after all artifacts are built
* [x] Wire the hook into `src/package.json` build config
      (`"afterAllArtifactBuild": "build/afterAllArtifactBuild.js"`)
* [x] Fix build blocker: `npm run package` failed at the native-rebuild step
      (`EALLOWSCRIPTS` — electron-builder 24's `npm rebuild --allow-scripts`
      vs npm 11). Set `"npmRebuild": false`; node-pty ships prebuilt binaries
      so no rebuild is needed.
* [x] Clean stale 0.1.1 artifacts from `releases/`
* [x] Run `npm run package` to produce v0.1.2 artifacts
* [x] Verify output: `Agent Command Engine 0.1.2.exe` (portable),
      `Agent Command Engine Setup 0.1.2.exe` (installer), and `Portable-ACE/`
* [x] Verify node-pty prebuilds are packaged into `app.asar.unpacked`
      (skipping the rebuild must not drop the native binary)
* [x] Update CHANGELOG, ticket memory

---

## Files Modified

- `src/build/afterAllArtifactBuild.js` (new)
- `src/package.json` (`npmRebuild: false`, `afterAllArtifactBuild` hook)
- `CHANGELOG.md`
- `.claude/memory/ticket_memory.md`

---

## Testing

- `npm run package` completes cleanly
- `releases/` contains the portable exe, the NSIS installer, and a
  `Portable-ACE/` folder (no `win-unpacked/`)
- Launch the app from inside `Portable-ACE/` to confirm the renamed folder
  still runs

---

## Result

Built v0.1.2 cleanly. `releases/` now contains:
- `Agent Command Engine 0.1.2.exe` — portable single-file (~92 MB)
- `Agent Command Engine Setup 0.1.2.exe` — NSIS installer (~92 MB)
- `Portable-ACE/` — renamed from `win-unpacked`, runs via `Agent Command Engine.exe`

The `afterAllArtifactBuild` hook logged `renamed portable folder win-unpacked → Portable-ACE`.
Confirmed node-pty's prebuilt binaries (`pty.node`, `conpty.node`, `winpty.dll`, etc.)
are present under `Portable-ACE/resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/`,
so skipping the rebuild did not drop the native module.

---

## Notes

The electron-builder `portable` win target produces a single self-extracting
`.exe`, not a folder — the only folder form of the app is the intermediate
`win-unpacked`, which is what "the portable version folder" refers to. The
rename is done in `afterAllArtifactBuild` (after the portable/nsis targets have
finished reading `win-unpacked`) rather than `afterPack` (which runs before
those targets and would break them). The hook is guarded by `existsSync` so
non-Windows builds are unaffected.

---

## Closed

2026-08-11
