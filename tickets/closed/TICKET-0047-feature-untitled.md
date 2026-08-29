# TICKET-0047

**Status**

Closed

**Type**

Chore

**Priority**

High

**Created**

2026-08-11

---

## Description

Cut the **v0.1.4** patch release. v0.1.3 shipped a crash-on-launch bug (packaged
app only): `SyntaxError: missing ) after argument list` at `DBService.js`, caused
by backticks inside the `agent_sessions` schema comment terminating the
`db.run(`…`)` template literal (fixed in df1a7f2, TICKET-0044). Since a broken
0.1.3 exe was already publicly released, ship the fix as a new patch version
rather than re-cutting 0.1.3.

Bump the version, finalize the changelog, rebuild the packaged Windows exes +
`Portable-ACE`, push, tag `v0.1.4`, and publish a GitHub release.

---

## Reason

The published v0.1.3 exe is unusable (crashes on load). A version bump is the
correct move: shipping a fixed exe under the already-published 0.1.3 number would
mean two different apps share one version.

---

## Implementation Plan

* [x] Bump `src/package.json` version 0.1.3 → 0.1.4
* [x] Bump `version.txt` (was stale at 0.1.1) → 0.1.4
* [x] Move CHANGELOG `[Unreleased]` → `[0.1.4] - 2026-08-11`
* [x] `npm test` clean (13/13)
* [x] `npm run package` → 0.1.4 portable + installer exes
* [x] Make `afterAllArtifactBuild` resilient to a locked `Portable-ACE`
* [x] Commit, push `main`
* [x] Tag `v0.1.4` + push tag
* [x] Publish GitHub release with both exes

---

## Files Modified

* `src/package.json` — version bump 0.1.3 → 0.1.4
* `version.txt` — 0.1.1 → 0.1.4
* `CHANGELOG.md` — released 0.1.4 (crash fix + release.bat GH_TOKEN + hook resilience)
* `src/build/afterAllArtifactBuild.js` — warn (not throw) when the old
  `Portable-ACE` is locked, so a running instance can't abort a release
* `.claude/memory/ticket_memory.md` — TICKET-0047 entry

---

## Testing

`npm test` (13/13 pass). `npm run package` produces both portable + NSIS exes
named `0.1.4` plus the `Portable-ACE` folder, verified present in `releases/`
before publishing.

---

## Result

v0.1.4 built and released. Both exes built successfully
(`Agent Command Engine 0.1.4.exe` portable + `Agent Command Engine Setup 0.1.4.exe`
NSIS, ~92MB each in `releases/`). The first `release.bat` run aborted at the
`afterAllArtifactBuild` folder-rename step: the old `releases/Portable-ACE` was
locked (`EPERM`) because three `Agent Command Engine.exe` processes (a live ACE
instance launched from that folder) were still running. The exes were already
built at that point, so rather than force-close the user's running app, the hook
was made resilient (warn + leave the fresh build in `win-unpacked`) and the
release completed manually: pushed `main`, tagged `v0.1.4`, published the GitHub
release with both exes via the `.env` `GH_TOKEN` (per TICKET-0045/0046).

Note: the on-disk `Portable-ACE` folder still holds the previous build until the
running ACE is closed; the fresh 0.1.4 unpacked app is in `releases/win-unpacked`.

---

## Notes

Release contents (v0.1.3..HEAD): TICKET-0044 (crash fix), TICKET-0046
(release.bat loads `GH_TOKEN` from `.env`).

Per TICKET-0045: this repo's gh auth is a work account without write access, so
the GitHub release needs the `.env` PAT via `GH_TOKEN` — `release.bat` now does
this automatically (TICKET-0046).

---

## Closed

2026-08-11
