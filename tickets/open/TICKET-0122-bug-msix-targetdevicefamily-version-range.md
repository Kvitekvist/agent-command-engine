# TICKET-0122 — MSIX ships a 2016 TargetDeviceFamily version range

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Low

**Created**

2026-09-03

---

## Description

The `.appx` from `scripts/build-msix.js` declared
`<TargetDeviceFamily MinVersion="10.0.14316.0" MaxVersionTested="10.0.14316.0" />`
— a 2016 Insider build. Store certification wants a real, recent tested range.

---

## Reason

electron-builder 24.13.3 hardcodes that value in its appx manifest template
and exposes no config hook. Upgrading electron-builder is a bigger change than
this warrants.

---

## Implementation Plan

* [x] After `electron-builder --win appx`, unpack the `.appx`, rewrite the
  TargetDeviceFamily line, repack with `makeappx` — all in `build-msix.js`
  (node `execFileSync`, array args, so paths with spaces are safe)
* [x] Set `MinVersion=10.0.17763.0` (Win10 1809, Electron's real floor),
  `MaxVersionTested=10.0.19041.0` (Win10 2004)
* [x] Guard: abort if the patch string no longer matches (electron-builder
  changed its default)
* [ ] Submit the 0.1.31 package and confirm certification no longer flags the
  device-family range

---

## Files Modified

- `scripts/build-msix.js` — unpack/patch/repack post-process

---

## Testing

`node scripts/build-msix.js` end to end: builds, packs, unpacks, patches,
repacks. `unzip -t` clean; manifest shows
`MinVersion="10.0.17763.0" MaxVersionTested="10.0.19041.0"`, identity and
`runFullTrust` unchanged.

---

## Result

Every `build-msix.js` run now emits a package with a current device-family
range. No dependency bump.

---

## Notes

The repack regenerates `AppxBlockMap.xml` and `[Content_Types].xml`, so the
script deletes the stale copies before `makeappx pack`.

---

## Closed

---
