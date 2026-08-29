# TICKET-0091 — Add signed, verifiable Windows/macOS releases and a controlled in-app

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Add signed, verifiable Windows/macOS releases and a controlled in-app update
channel with rollback and release-note visibility.

## Reason

ACE currently disables update metadata and does not define a complete signing,
notarization, staged-update, or rollback policy. Manual distribution leaves
users on vulnerable or incompatible builds.

## Implementation Plan

* [ ] Define signing, notarization, secret handling, and supported OS policy
* [ ] Publish checksummed signed artifacts from CI
* [ ] Add opt-in update checks and release-note display
* [ ] Add staged rollout, failed-update recovery, and rollback behavior
* [ ] Document offline/manual update workflow

## Files Modified

---

## Testing

* [ ] Signature/notarization verification
* [ ] Update and rollback tests on Windows/macOS
* [ ] Offline and corrupted-download behavior

## Result

---

## Notes

Depends on TICKET-0085 and TICKET-0086.

## Closed

---
