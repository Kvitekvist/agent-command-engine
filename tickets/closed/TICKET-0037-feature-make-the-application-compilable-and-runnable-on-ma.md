# TICKET-0037 — Make the application compilable and runnable on macOS in addition

**Status**

Closed

In Progress

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-10

---

## Description

Make the application compilable and runnable on macOS in addition to Windows.
Currently, several areas of the codebase are Windows-only: runnable file
extensions and spawn logic in FileService, hardcoded `.bat`/`.exe`/`.ps1`
extensions in the renderer's FileTree, shell helper scripts (only `.bat`
files exist), and the package.json mac build target is minimal.

---

## Reason

Broaden the user base to macOS developers who also use Claude Code and
Codex CLI. The core Electron + React architecture is inherently
cross-platform; only a handful of platform-specific code paths need
adjustment.

---

## Implementation Plan

* [x] Expose `process.platform` to renderer via preload (`cpi.platform`)
* [x] Make `FileService.js` platform-aware: add macOS runnable extensions
      (`.sh`, `.command`, `.app`) and handle `runFile()` spawning on macOS
      (`open` for `.app`, `/bin/sh` for `.sh`/`.command`)
* [x] Make `FileTree.jsx` use the exposed platform to choose the correct
      runnable extensions set for the context menu
* [x] Enhance `package.json` mac build config: add `category`,
      architecture targets (x64 + arm64), and `entitlements`/
      `hardenedRuntime` for macOS code signing
* [x] Create macOS shell script equivalents: `setup.sh`, `build.sh`,
      `run.sh`, `clear_cache.sh`
* [x] Update CHANGELOG, README, architecture docs, ticket memory

---

## Files Modified

- `src/main/preload.js`
- `src/main/services/FileService.js`
- `src/renderer/components/FileTree.jsx`
- `src/package.json`
- `scripts/setup.sh` (new)
- `scripts/build.sh` (new)
- `scripts/run.sh` (new)
- `scripts/clear_cache.sh` (new)
- `CHANGELOG.md`
- `README.md`
- `.claude/memory/architecture.md`
- `.claude/memory/ticket_memory.md`
- `.claude/memory/project_memory.md`

---

## Testing

- `npm run build` passes cleanly
- `npm test` passes (11/11)
- Manual: verify `npm run package` produces a `.dmg` on a macOS machine
  (not verifiable from this Windows environment)
- Manual: verify right-click context menu shows Run for `.sh`/`.command`
  files on macOS and for `.bat`/`.exe` etc. on Windows

---

## Result

---

## Notes

### Already cross-platform (no changes needed)

- `ptyHost.js` — `defaultShell()` already handles macOS
  (`process.env.SHELL || '/bin/bash'`)
- `TerminalService.js` — `windowsHide: true` is harmless on macOS
  (ignored by Node.js on non-Windows)
- `AgentService.js` — `shell: process.platform === 'win32'` already
  platform-gated
- `TokscaleService.js` — non-win32 path already goes through the JS shim
  via `ELECTRON_RUN_AS_NODE=1`
- `ScreenshotService.js` — uses cross-platform Electron APIs
  (`desktopCapturer`, `screen`, etc.)
- `index.js` — already has the standard macOS `process.platform !==
  'darwin'` quit pattern
- `agentLaunch.js` — `PowerShell` tool references in `--allowedTools`
  are harmless on macOS (Claude Code ignores unknown tool names)

---

## Closed

2026-08-29

