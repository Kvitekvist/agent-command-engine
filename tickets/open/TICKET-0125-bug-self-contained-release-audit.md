# TICKET-0125 — Make a shipped ACE install self-contained

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-05

---

## Description

Audit of everything a released, installed copy of ACE depends on, and fixes
for the places where it reached outside itself. Four things a user's machine
was expected to supply that ACE never shipped:

1. **Fonts came from the Google Fonts CDN.** `renderer/index.html` linked
   `fonts.googleapis.com` for Inter and JetBrains Mono. An installed app with
   no network, or behind a firewall, silently fell back to generic system
   faces, and every launch made an outbound request the app had no reason to
   make.
2. **The Intel macOS dmg shipped an arm64 tokscale binary.** electron-builder
   builds the x64 and arm64 dmg from one `node_modules`, and `npm ci` installs
   only the optional native package matching the runner's own arch. The macOS
   runners are arm64, so the x64 dmg carried a binary an Intel Mac cannot
   execute: the Usage tab read 0 with no visible error. `smoke-package.js`
   skipped that bundle by design (`continue // e.g. an x64 bundle on an arm64
   runner`), so nothing caught it.
3. **The `/push-update` skill was never shipped.** The "Push update"
   quick-action button types `/push-update` into the agent terminal, and
   README lists it as a feature, but the skill file existed only in ACE's own
   repository. In any other project the command did not exist.
4. **The window icon path pointed inside `app.asar` at a file not in the
   build.** `getIconPath()` resolved `../../assets/icons/icon.ico`, but
   repo-root `assets/` sits outside the packaged app directory and is not in
   electron-builder's `files` list.

Checked and found already correct: Monaco (bundled locally by
`vite-plugin-monaco-editor-esm`), sql.js WASM (`require.resolve`, asar-safe),
node-pty (ships prebuilds for darwin-x64/arm64 and win32-x64/arm64; its
loader falls through a wrong-arch `build/Release` to the right prebuild), the
project scaffold (`extraResources`), the notification sound (TICKET-0124), and
the PTY host (runs the Electron binary as node when packaged, so no system
Node is required). No hardcoded machine paths in shipping source.

---

## Reason

A release is only installable for other users if it carries what it needs. Each
of the four failures above was invisible from the development machine, where
the network is up, the arch matches, and ACE's own `.claude/` supplies the
skill.

---

## Implementation Plan

* [x] Bundle Inter and JetBrains Mono via `@fontsource`, latin subsets at the
  weights the UI uses; drop the CDN links from `index.html`

* [x] Install both macOS tokscale binaries in the release workflow before
  packaging

* [x] Assert in `smoke-package.js` that every packaged bundle carries the
  binary for its own arch, spawning only the one the runner can execute

* [x] Ship the `push-update` skill in the project template, and install it into
  any project missing it at terminal spawn

* [x] Make the window icon dev-only rather than a dead reference in a packaged
  build

* [x] Remove the dead `@shared` Vite alias (no `src/shared` exists)

---

## Files Modified

- `src/package.json` — `@fontsource/inter`, `@fontsource/jetbrains-mono`
- `src/renderer/index.html` — removed the Google Fonts links
- `src/renderer/styles/globals.css` — local `@fontsource` imports
- `src/main/index.js` — `getIconPath()` is dev-only
- `src/main/services/ProjectScaffoldService.js` — `ensurePushUpdateSkill()`
- `src/main/ipc/handlers.js` — `getScaffoldDir()` helper; `terminal:spawn`
  installs the skill through `resolveProjectRoot`
- `src/main/project-template/.claude/skills/push-update/SKILL.md` — added
- `src/scripts/smoke-package.js` — per-bundle arch check
- `src/vite.renderer.config.mjs` — dropped the `@shared` alias
- `src/tests/project-scaffold.test.js` — `ensurePushUpdateSkill` coverage
- `.github/workflows/release.yml` — cross-arch tokscale install

---

## Testing

- `npm test` — 74 tests, 73 pass, 1 skipped (POSIX-only chmod case on Windows)
- `npm run build` — renderer emits five local `.woff2` files (115 KB total);
  built `dist/renderer/index.html` contains no `fonts.googleapis.com`
- `smoke-package.js` driven against a synthetic `ACE_RELEASES_DIR`: passes on
  an x64 bundle with its binary, fails with the new per-arch message when an
  arm64 bundle has none

Still to verify live: launch a packaged build offline and confirm the UI
renders in Inter, and press "Push update" in a project ACE did not scaffold.

---

## Result

---

## Notes

Two items found by the audit are deliberately **not** in this ticket:

- **`LICENSE` is still the project-template placeholder** ("No license has been
  chosen yet for this project"). Distributing installers under that text gives
  users no right to run or redistribute ACE. Picking a license is the owner's
  call, not an agent's — it needs a decision before the next public release.
- **No Linux packaging target**, though `TokscaleService`, the prereq checks
  and the shell handling all support Linux. Either add a target or say so in
  the README.

`npm install --force` in the release workflow is what gets npm past its own
platform check for a package installed for another arch; `--cpu` / `--os` are
ignored for a direct install on npm 11 (verified). `--no-save` keeps
`package-lock.json` untouched.

---

## Closed

