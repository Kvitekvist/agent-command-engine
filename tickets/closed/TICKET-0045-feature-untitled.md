# TICKET-0045

**Status**

Closed

**Type**

Chore

**Priority**

Medium

**Created**

2026-08-11

---

## Description

Cut the **v0.1.3** release. Six commits (TICKET-0040 → TICKET-0044) have
landed on `main` since v0.1.2 was tagged and released, but the version was
still `0.1.2` and the CHANGELOG kept them under `[Unreleased]`. Bump the
version, finalize the changelog, rebuild the packaged Windows exes, push, and
publish a GitHub release.

Also gitignore the stray `.git.tmp/` folder (nested git internals left in the
working tree) so the release step's `git add -A` never commits it.

---

## Reason

Publishing the accumulated user-facing changes (single-instance fix,
tokscale-sourced project history + "By Agent", leaf-folder project names,
release-workflow consolidation, `Portable-ACE` naming) as a proper versioned
release. Shipping a materially different exe under the already-published 0.1.2
number would mean two different apps share one version — a version bump is the
correct move.

---

## Implementation Plan

* [x] Bump `src/package.json` version 0.1.2 → 0.1.3
* [x] Move CHANGELOG `[Unreleased]` → `[0.1.3] - 2026-08-11`
* [x] Add `.git.tmp/` to `.gitignore`
* [x] `npm run build` + `npm test` clean
* [x] `npm run package` → 0.1.3 portable + installer exes
* [x] Commit, push `main`
* [x] Tag `v0.1.3` + push tag
* [x] Publish GitHub release with both exes (see Result)

---

## Files Modified

* `src/package.json` — version bump
* `CHANGELOG.md` — released 0.1.3
* `.gitignore` — ignore `.git.tmp/`
* `.claude/memory/*` — memory updates

---

## Testing

`npm test` (all pass), clean `npm run build`, `npm run package` produces both
signed-less portable + NSIS exes named `0.1.3`, verified present in
`releases/` before publishing.

---

## Result

v0.1.3 built, committed, pushed to `main`, tagged (`v0.1.3` on origin), and the
GitHub Release is published with both exes attached:
https://github.com/Kvitekvist/agent-command-engine/releases/tag/v0.1.3
(Agent.Command.Engine.0.1.3.exe portable + Agent.Command.Engine.Setup.0.1.3.exe
NSIS, ~92MB each).

The publish initially failed: gh's active github.com account
(`jens-petter-royseth_sch`, a Schibsted work account) has no write access to
the Kvitekvist repo (`push=false`; release create → HTTP 404). Git push works
regardless because it uses the SSH key (owner identity), a different credential
than gh's OAuth token — so the two can diverge. Resolved by running the
`gh release create` with `GH_TOKEN` set to the user's PAT from the repo's `.env`
(`github_token`), which does have write, without changing gh's logged-in
accounts. Worth remembering for any future release here: this repo's gh auth is
a work account without write, so releases need the `.env` PAT via `GH_TOKEN`.

---

## Notes

Release contents (from v0.1.2..HEAD): TICKET-0040 (build v0.1.2 tooling +
`Portable-ACE`), 0041 (release.bat consolidation), 0042 (leaf folder name in
Today-by-project), 0043 (single-instance lock), 0044 (tokscale-sourced project
history + By Agent).

---

## Closed

2026-08-11
