# Handoff: packaging-smoke-test (2026-08-25 15:21)

## What this session did
- Implemented TICKET-0101 packaging smoke test: `src/scripts/smoke-package.js`
  runs against `../releases` output, walks every `app.asar.unpacked`, resolves
  the tokscale binary via `TokscaleService.nativePackageFor`, asserts it exists +
  is executable + spawns `--version` (exit 0, non-empty stdout).
- Wired it into `.github/workflows/release.yml` as a "Smoke-test packaged build"
  step after `npm run package`, before upload. Kept OFF the per-PR `tests.yml`.
- Closed TICKET-0101 (moved to `tickets/closed/`), added CHANGELOG "Added" entry.
- Committed, pushed a feature branch (direct push to main is blocked by a
  pre-push guard), opened PR #2, checks went green (macOS/Ubuntu/Windows unit
  matrix), squash-merged as `277a4f9`, branch deleted, local main fast-forwarded.
- Confirmed the throwaway diagnostic files (`src/diagnose-*.js`) are already gone
  and the repo is clean apart from `.claude/handoffs/`.
- Gave the user a Mac duplicate-app-icon cleanup script (not yet run by them).

## Decisions & rationale
- Smoke test reuses `nativePackageFor` from the source service so it looks for
  exactly what the app resolves at runtime — drift fails the test. Rejected a
  headless Electron GUI launch (heavier/flakier) for a direct
  `spawnSync(binary, ['--version'])`.
- Only same-arch bundles are exercised (a cross-arch binary may not run on the
  runner), so the spawn assertion is real.
- `ACE_RELEASES_DIR` env override added purely to make the failure path testable.
- Shipped via feature branch + PR because the repo's pre-push hook blocks direct
  pushes to main (recommends branch+PR; `ALLOW_MAIN_PUSH=1` override declined).
- Smoke test lives only on the release workflow (tag push), not per-PR CI, so it
  won't appear in PR checks — by design (packaging is slow).

## Gotchas
- `rm`/`rm -rf` is BLOCKED by policy for the assistant — even in scripted test
  cleanup. Use `mktemp -d` (self-cleans); never add `rm`.
- Direct `git push origin main` is BLOCKED by a pre-push guard. Always branch+PR.
- Switching off the feature branch back to main made `release.yml`/`CHANGELOG.md`
  "change on disk" — that's just main predating the changes; harmless, resolved
  on merge.
- `/agent-command-engine-broken/...` in the LaunchServices dump is a ghost (dir
  deleted); only `lsregister -kill -r` clears it.
- `releases/` is build output, so every `npm run package` re-drops `.app`
  bundles Spotlight re-indexes. Long-term fix: add it to Spotlight Privacy.

## State / receipt
- Repo / worktree: /Users/palin.wisarutnart@m10s.io/Documents/agent-command-engine, branch `main`
- Last verified command + result: `gh pr checks 2` -> all 3 pass;
  merged `gh pr merge 2 --squash` -> `277a4f9`; `git log -1` == 277a4f9 == origin/main
- Plan or tracking doc (if any): tickets/closed/TICKET-0101.md
- Completed: TICKET-0101 implemented, verified, merged to main. TICKET-0100
  (original Mac token fix) already merged earlier (PR #1, 23d3fcb).
- Pending: nothing required in-repo. Optional user-side housekeeping only:
  (1) run the Mac duplicate-icon cleanup script; (2) decide what to do with the
  untracked `.claude/handoffs/` (this handoff commits it).

## Recheck live before acting
- `git status` — expect clean on main at 277a4f9 (this handoff may add a commit)
- Re-run `bash scripts/run_tests.sh` (74 tests) and `node src/scripts/smoke-package.js`
- Ask the user whether the Mac icon cleanup was run (was still pending)

## Suggested skills
- none

## References (do not duplicate - point to them)
- PR #2 (merged, squash 277a4f9): https://github.com/Kvitekvist/agent-command-engine/pull/2
- src/scripts/smoke-package.js
- .github/workflows/release.yml (Smoke-test packaged build step)
- tickets/closed/TICKET-0101.md
- CHANGELOG.md ([Unreleased] > Added)
- Prior work PR #1 (squash 23d3fcb): TICKET-0098/0099/0100
