# TICKET-0046

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-11

---

## Description

Make `scripts/release.bat` publish the GitHub release successfully on this
machine by loading the `github_token` PAT from the repo-root `.env` into
`GH_TOKEN` before the `gh` calls.

---

## Reason

`gh`'s logged-in github.com account here (a Schibsted work account) has no
write access to `Kvitekvist/agent-command-engine`, so plain `gh release
create`/`upload` returns HTTP 404 (discovered in TICKET-0045). Git
push/commit/tag work regardless because they use the SSH key (owner identity),
a different credential — so the git half of `release.bat` succeeds while the
`gh` half fails. The repo's `.env` already holds a `github_token` PAT that does
have write; setting `GH_TOKEN` from it overrides gh's keyring auth for the
batch process only (`setlocal`), without changing the user's logged-in
accounts.

---

## Implementation Plan

* [x] In `release.bat`, after reading the version, load `github_token` from
      `%ROOT%\.env` (if present) into `GH_TOKEN`
* [x] Print whether the token was found (never the token value)
* [x] Leave git push/commit/tag untouched (SSH-based, already work)
* [x] Update CHANGELOG + memory

---

## Files Modified

* `scripts/release.bat`
* `CHANGELOG.md`
* `.claude/memory/ticket_memory.md`

---

## Testing

Parsed a real `.env` via the same `for /f` logic in `cmd`, confirming
`GH_TOKEN` gets defined (checked its length, never printed the value). Full
pipeline not re-run end-to-end against 0.1.3 (already released; a re-run would
just re-clobber the same assets) — the `gh` path itself was proven live in
TICKET-0045 with `GH_TOKEN` set to this same PAT.

---

## Result

`release.bat` now sources `github_token` from `.env` into `GH_TOKEN`, so the
whole pipeline (compile → commit → push → merge-if-needed → tag → publish
release with exes) works on this machine without changing gh's logged-in
accounts. If `.env` has no `github_token`, it falls back to whatever gh is
logged in as (prints a note either way).

---

## Notes

`.env` is gitignored, so the token is never committed. `GH_TOKEN` is scoped to
the batch `setlocal` environment and does not persist after the script exits.

---

## Closed

2026-08-11
