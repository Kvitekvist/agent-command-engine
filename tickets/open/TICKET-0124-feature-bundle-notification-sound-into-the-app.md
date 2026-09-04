# TICKET-0124 — Bundle the notification sound into the app

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-04

---

## Description

The stop/notification sound only worked where a developer had hand-created a
gitignored `.claude/settings.local.json` pointing at
`.claude/hooks/play-notification.js`. A clean install, or an agent run in any
project other than the ACE repo, got no sound. The status badge, by contrast,
works everywhere because `HookService` generates and wires it.

Make the sound work the same way: shipped with the app, wired automatically
into the `--settings` file every agent launches with, on Windows and macOS,
with no per-project setup.

---

## Reason

`HookService.ensureHookFiles()` already writes `agent-status.js` +
`settings.json` into `userData` and ACE passes that file to `claude
--settings`. Adding the sound there means it travels with the app.

---

## Implementation Plan

* [x] Inline `SOUND_SCRIPT` in `HookService.js` (like `HOOK_SCRIPT`):
  synchronous, cross-platform — `afplay` on macOS, `SoundPlayer.PlaySync` on
  Windows, `paplay`/`aplay`/`ffplay` on Linux; takes the audio path and mute
  marker as argv
* [x] Bundle `assets/notification.wav` via electron-builder `extraResources`;
  `ensureHookFiles()` copies it to `userData/ace-hooks/notification.wav`
  (`process.resourcesPath` packaged, repo `assets/` in dev)
* [x] Wire `Stop` + `Notification` to `status + sound`; `UserPromptSubmit` /
  `PreToolUse` stay status-only
* [x] Mute: `settings:set('notification_sounds_muted')` now writes one global
  `userData/ace-hooks/.muted` instead of a per-project `.claude/.notification-muted`
* [x] `hook-service.test.js`; `getAppPath` added to the electron test stub

---

## Files Modified

- `src/main/services/HookService.js` — `SOUND_SCRIPT`, audio copy, sound wiring
- `src/main/ipc/handlers.js` — global mute marker
- `src/package.json` — `extraResources` entry for `notification.wav`
- `src/tests/hook-service.test.js` (new), `src/tests/helpers/electron-stub.js`

---

## Testing

`npm test` — 72 pass / 1 skip. WASAPI loopback capture of the **generated**
`userData/ace-hooks/play-notification.js` + copied `notification.wav`: audio
at -9.9 dBFS; with `.muted` present, silence. macOS `afplay` path not run
on-device (standard synchronous macOS player, same call the previous hook
used).

---

## Result

Stop/Notification sound plays out of the box on a clean install, in every
project ACE launches an agent in, on Windows and macOS. Toggle from Settings.

---

## Notes

- `.claude/hooks/play-notification.js` and `.claude/settings.local.json` in
  this repo are unchanged; they still serve bare Claude Code sessions run
  against the ACE repo directly. If you run ACE agents on the ACE repo,
  remove the Stop/Notification sound entries from your local
  `settings.local.json` to avoid a double play now that the app provides it.
- Needs a repackage to reach installed copies (`scripts/release.bat` /
  `build-msix.js`).

---

## Closed

---
