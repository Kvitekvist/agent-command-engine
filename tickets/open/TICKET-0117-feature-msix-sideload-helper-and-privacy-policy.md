# TICKET-0117 — MSIX sideload helper + privacy policy for Store submission

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

Two things needed before the MSIX package (TICKET-0115/0116) can be submitted:
a way to smoke-test the package locally, and a privacy policy to link from the
Partner Center listing.

---

## Reason

- The `.appx` is unsigned (the Store re-signs on ingestion), so it can't be
  installed as-is. A test cert whose subject matches the manifest publisher,
  trusted in `LocalMachine\TrustedPeople`, lets it sideload.
- Partner Center requires a privacy-policy URL for any app that touches user
  files or launches network-capable tools.

---

## Implementation Plan

* [x] `scripts/sign-and-install-msix.ps1` — create/reuse a test cert from
  `build.appx.publisher`, trust it, sign a copy under `releases/sideload/`,
  reinstall, print launch/uninstall commands. Leaves `releases/*.appx`
  unsigned for the Store upload.
* [x] `docs/privacy-policy.md` — local-only app, no telemetry, no network
  calls of its own; names the third-party CLIs and their policies.
* [ ] Run the helper elevated; launch the packaged app; start an agent and
  confirm node-pty, CLI spawn, and the notification sound work.
* [ ] Host `privacy-policy.md` at a public URL; put that URL in Partner Center.

---

## Files Modified

- `scripts/sign-and-install-msix.ps1` — new
- `docs/privacy-policy.md` — new

---

## Testing

`scripts/sign-and-install-msix.ps1` not yet run. `docs/privacy-policy.md`
reflects the app's actual behaviour: a repo-wide search of `src/main` found no
outbound HTTP/socket calls; all writes go to `userData` or a registered
project dir.

---

## Result

One command signs and installs the package for testing; a privacy policy is
ready to host.

---

## Notes

Publisher CN (`CN=7F30662C-…`) is stable across the product reservations. The
helper reads identity from `src/package.json` so it needs no edit if
`identityName` changes.

---

## Closed

---
