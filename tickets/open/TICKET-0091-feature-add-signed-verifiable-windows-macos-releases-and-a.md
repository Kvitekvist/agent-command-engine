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

2026-09-14: user deferred signing for this audit pass. Keep the prepared signing
workflow/documentation, but do not treat missing certificates as a blocker for
the remaining non-signing repairs or claim that signed delivery was verified.

Add signed, verifiable Windows/macOS releases with checksums, release notes and
a documented manual/offline update path. AUDIT-32 narrows the first delivery to
manual updates; automatic rollout infrastructure is deferred until needed.

## Reason

ACE currently disables update metadata and does not define a complete signing,
notarization, staged-update, or rollback policy. Manual distribution leaves
users on vulnerable or incompatible builds.

## Implementation Plan

### Audit continuation, 2026-09-14

Require signed artifacts and notarization before upload, publish checksums, document manual/offline update. Defer auto-rollout until needed per AUDIT-32.

* [x] Document signing/notarization secrets and manual/offline update handling
* [ ] Publish checksummed signed artifacts from CI
* [x] Document offline/manual update workflow and backup-based rollback
* Deferred by AUDIT-32: automatic update checks and staged rollout until needed

## Files Modified

Audit continuation: release.yml, release-checksums.js, docs/agents/release-delivery.md, README.md.

---

## Testing

Audit continuation: Unsigned Windows diagnostic package passes runtime checks. Signing credentials are not established, so signatures/notarization and clean Windows/macOS installs remain blocked; no release was published.

* [ ] Signature/notarization verification
* [ ] Update and rollback tests on Windows/macOS
* [ ] Offline and corrupted-download behavior

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

Depends on TICKET-0085 and TICKET-0086.

## Closed

---
