# TICKET-0115 — MSIX/AppX package for Microsoft Store submission

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

Produce an MSIX package of ACE for the Microsoft Store. A Partner Center
product is reserved (Store ID `9N64PL478DHP`, name `JensR.AgnetCommandEngine`).
electron-builder's `appx` target builds an OPC/MSIX container; Partner Center's
MSIX submission accepts the `.appx` extension directly, so no build-tooling
change is needed.

---

## Reason

The Store needs a packaged, identity-stamped build. ACE already writes only to
`userData` / project dirs (never its install dir), so it runs unmodified under
MSIX's read-only install location. It declares `runFullTrust` (added
automatically by electron-builder) because it spawns PTYs, `powershell.exe`,
and the `claude` / `codex` CLIs.

---

## Implementation Plan

* [x] Pull package identity from Partner Center > Product identity
* [x] Add `build.appx` to `src/package.json` (identityName, publisher,
  publisherDisplayName, applicationId, backgroundColor, tiles)
* [x] Generate tile PNGs into `src/build/appx/` from the 1024px app icon
* [x] `scripts/build-msix.js` — `npm run build` + `electron-builder --win appx`
* [x] Replace `&` with `and` in `package.json` description (raw `&` is invalid
  XML and broke `makeappx`)
* [x] Build a valid `.appx` locally
* [ ] Install the `.appx` on a clean Windows box and launch an agent — confirm
  node-pty (conpty/winpty) and CLI spawning work under `runFullTrust`
* [ ] Upload to Partner Center; complete listing, age rating, pricing,
  privacy-policy URL, `runFullTrust` justification, cert notes about the
  external CLIs; submit

---

## Files Modified

- `src/package.json` — `build.appx` block; `description` no longer contains `&`
- `src/build/appx/*.png` — Store tile assets (new)
- `scripts/build-msix.js` — new
- `CHANGELOG.md`

---

## Testing

`node scripts/build-msix.js` produced
`releases/Agent Command Engine 0.1.30.appx` (~160 MB, unsigned). Unzipped and
checked the manifest: `Identity Name="JensR.AgnetCommandEngine"`,
`Version="0.1.30.0"`, `rescap:runFullTrust`, `EntryPoint`
`Windows.FullTrustApplication`. Not yet installed or run from the package.

---

## Result

An unsigned Store-ready `.appx` builds from one command. Submission and a
real install/run test are the remaining manual steps.

---

## Notes

- Upload the `.appx` **unsigned** — the Store re-signs on ingestion.
- The reserved name is `AgnetCommandEngine` ("Agnet", not "Agent"). To fix,
  reserve the correct name in Partner Center and update `build.appx.identityName`
  + `applicationId` to match; identity must equal the reservation.
- electron-builder 24.13.3 hardcodes `MaxVersionTested=10.0.14316.0`. If
  certification flags it, bump electron-builder or patch `AppxManifest.xml` and
  repack with `makeappx`.
- No auto-update code in ACE, so nothing to disable for the Store build.

---

## Closed

---
