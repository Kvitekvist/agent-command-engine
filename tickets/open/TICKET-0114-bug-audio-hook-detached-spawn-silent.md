# TICKET-0114 — Notification hook never actually played audio (detached spawn)

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-03

---

## Description

The Stop / Notification sound hook (`.claude/hooks/play-notification.js`) never
produced audio on Windows, despite the hook firing on every event and exiting
0. TICKET-0111 replaced the MCI player with a cscript/VBScript one and verified
it by running the `.ps1` directly — but the hook never runs it directly.

---

## Reason

`play-notification.js` spawned the player with `{ detached: true }`, called
`child.unref()`, then `process.exit(0)` immediately. On Windows the child is
torn down as the parent exits, before it emits a sample. Every "did it fire"
check passed while nothing played.

Confirmed with a WASAPI loopback capture of the default output device:

| invocation | peak | verdict |
| --- | --- | --- |
| silence control | -240 dBFS | silent |
| `ffplay` the file directly | -11 dBFS | audio |
| old hook (`node play-notification.js`) x3 | -240 dBFS | silent |
| new hook x3 | -8 dBFS each | audio |
| new hook, mute marker present | -240 dBFS | silent |

---

## Implementation Plan

* [x] Reproduce: loopback-capture system audio while running the hook — silent
* [x] Root-cause: detached spawn + immediate `process.exit(0)` kills the player
* [x] Make playback synchronous (`spawnSync`, hook blocks ~2s for the clip)
* [x] Windows: inline `System.Media.SoundPlayer(...).PlaySync()` — WinMM
  `PlaySound`, no window handle, no COM apartment, no temp VBScript
* [x] Drop `play-seatbelt.ps1` / `play-seatbelt-with-logging.ps1` (the COM/MCI
  workarounds are no longer needed)
* [x] Add `assets/notification.wav` (SoundPlayer is WAV-only), converted from
  the mp3
* [x] Re-validate on Windows with loopback capture, 3 consecutive runs + mute

---

## Files Modified

- `.claude/hooks/play-notification.js` — synchronous playback; per-platform
  players; Windows uses `SoundPlayer.PlaySync`
- `.claude/hooks/play-seatbelt.ps1` — deleted
- `.claude/hooks/play-seatbelt-with-logging.ps1` — deleted
- `.claude/hooks/README.md` — mp3 → wav, note synchronous playback
- `assets/notification.wav` — new
- `CHANGELOG.md`, `src/package.json`, `version.txt` — 0.1.30

---

## Testing

Windows loopback capture (`soundcard` + `numpy`, dev-only) — see the table
above. 3 consecutive Stop invocations each captured a -8 dBFS waveform
identical to a direct play; the silence control captured nothing; the mute
marker suppressed playback. macOS/Linux paths are structurally the same
synchronous call and were not run on-device.

---

## Result

The notification sound plays on Stop / SubagentStop / Notification. The hook
blocks for the ~2s the clip lasts instead of firing a detached player that
never ran.

---

## Notes

The mute marker (`<project>/.claude/.notification-muted`, written per project
by the `notification_sounds_muted` toggle) and the systemFallback path are
unchanged.

---

## Closed

---
