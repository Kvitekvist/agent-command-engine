# TICKET-0111 — Fix audio hook silent in detached/headless sessions

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Low

**Created**

2026-09-02

---

## Description

The Stop hook notification sound never played. The PowerShell player script used
Windows MCI (`winmm.dll` / `mciSendString`) with the `play notif wait` flag,
which requires an interactive window handle. When spawned detached from Node.js
(no stdio, no console), the MCI call silently stalled and the script exited
without producing audio.

---

## Reason

`play-notification.js` spawns `play-seatbelt.ps1` with `detached: true` and
`stdio: 'ignore'`. In that context MCI's WMPlayer COM object enters
`wmppsTransitioning` (state 9) and never plays. cscript.exe provides its own
COM STA message pump and resolves the deadlock.

---

## Implementation Plan

* [x] Diagnose root cause: WMPlayer COM stuck in state 9 under detached spawn
* [x] Replace MCI approach with cscript.exe + temp VBScript using WMPlayer.OCX.7
* [x] Verify playback duration (~3s block confirms audio played through)

---

## Files Modified

- `.claude/hooks/play-seatbelt.ps1` — rewritten to use cscript/VBScript instead of MCI

---

## Testing

Ran `play-seatbelt.ps1` directly via PowerShell and measured elapsed time:
- Old approach: returned instantly (no audio)
- New approach: blocked ~3.3 seconds (full track played through)

---

## Result

Audio hook now plays the notification sound when Claude stops.

---

## Notes

`settings.local.json` (gitignored) was also updated to add `Notification` hook
matchers for `permission_prompt` and `idle_prompt`, but that change is local-only.

---

## Closed

---
