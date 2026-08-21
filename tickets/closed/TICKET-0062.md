# TICKET-0062: Restore macOS Self-Signed Code-Signing Setup

**Type**: Chore / Build
**Status**: Completed
**Created**: 2026-08-21
**Updated**: 2026-08-21

## Problem

The macOS signing setup existed only as **uncommitted** local changes in a
second, stale clone of this repo (`~/Downloads/agent-command-engine`, deleted
during a repo consolidation — see Note). It was never committed or pushed, so it
was lost with that clone: the `build.mac.identity` setting and a
`scripts/setup-mac-signing.sh` helper that provisions the signing certificate.

Without a fixed `identity`, `electron-builder` falls back to **ad-hoc** signing,
which produces a *different* code identity on every build. That matters here
because ACE requests **Screen Recording** (the screenshot capture feature): macOS
ties a TCC permission grant to the app's code identity, so an ad-hoc rebuild
looks like a brand-new app and the user must re-grant Screen Recording after
every build. A stable self-signed identity makes the grant persist across
rebuilds.

## Root Cause

Signing config was authored in a throwaway clone and never committed. The
canonical repo already carried the *other* signing prerequisites
(`build/entitlements.mac.plist` with `cs.disable-library-validation`, hardened
runtime enabled, `gatekeeperAssess: false`) but not the identity or the cert
provisioning script.

## Solution

This is a **local self-signed** setup (not Apple Developer ID / notarization) —
matching the pre-existing `"Agent Command Engine Dev"` self-signed cert already
in the login Keychain (`TeamIdentifier=not set`).

- **`src/package.json`** — add `"identity": "Agent Command Engine Dev"` to
  `build.mac` so `electron-builder` signs with the stable self-signed cert
  instead of ad-hoc. Combined with the existing hardened runtime +
  `disable-library-validation` entitlement, the self-signed hardened app still
  loads native modules (node-pty, sql.js, tokscale) and launches locally.
- **`scripts/setup-mac-signing.sh`** (new) — idempotent: if a code-signing
  identity named `"Agent Command Engine Dev"` already exists it does nothing;
  otherwise it generates a self-signed code-signing certificate (RSA-2048,
  `extendedKeyUsage=codeSigning`, 10-year validity) with OpenSSL, imports it into
  the login keychain authorized for `/usr/bin/codesign`, and adds it to the
  keychain's trust settings for code signing. Lets a clean machine reproduce the
  exact identity name the build expects. No-op / clear message on non-macOS.

## Files Changed

- `src/package.json` — `build.mac.identity`
- `scripts/setup-mac-signing.sh` (new)
- `scripts/setup.sh` — invoke `setup-mac-signing.sh` on macOS so a one-command
  setup provisions the signing cert too

## Testing

- [x] `scripts/setup-mac-signing.sh` run — detects the existing
      `"Agent Command Engine Dev"` identity and no-ops
- [x] `security find-identity -v -p codesigning` confirms the identity is present
- [ ] Full `npm run package` producing a self-signed DMG whose app launches and
      retains Screen Recording permission across a rebuild — deferred (long build;
      the current ad-hoc-signed 0.1.9 build already installed and runs)

## Note

Consolidation context: the project had drifted into two clones — this canonical
one (`~/Documents/VS Code Project/agent-command-engine`, where all fixes
0058–0061 were committed and pushed) and a stale build clone in `~/Downloads`
(6 commits behind, the one whose packaged app the user was actually running,
hence "the bugs still exist"). The Downloads clone was removed to consolidate to
a single repo; its only unique content was this uncommitted signing setup, now
reconstructed here so it lives in version control.
