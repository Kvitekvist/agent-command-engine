# TICKET-0041

**Status**

Closed

**Type**

Chore

**Priority**

Low

**Created**

2026-08-11

---

## Description

Prune obsolete helper scripts and consolidate the release workflow into a
single `release.bat`.

Remove the Electron-binary download rescue kit (`download-electron.js`,
`download-electron.ps1`, `fix-electron.bat`): a one-time workaround for
proxy/firewall-blocked Electron postinstall downloads. It is unreferenced by
the normal setup flow (`setup.bat`/`setup.sh` just run `npm install`, which
works — the app builds and packages fine), and `download-electron.ps1` is
broken anyway (uses batch-style `goto`/labels that are invalid in PowerShell).

Per user request, collapse the separate git helpers (`git_commit.bat`,
`git_push.bat` — the latter also stale, falsely claiming no remote is
configured) into one `release.bat` that runs the whole release pipeline:
compile the exe, commit, push, merge into main if on a feature branch, then
tag and publish a GitHub release with the exe attached.

---

## Reason

Dead code and misleading helper scripts erode maintainability (CLAUDE.md:
"Never leave dead code"). The kept helpers must be trustworthy and functional.

---

## Implementation Plan

* [x] Delete `scripts/download-electron.js`
* [x] Delete `scripts/download-electron.ps1`
* [x] Delete `scripts/fix-electron.bat`
* [x] Delete `scripts/git_commit.bat` (folded into `release.bat`)
* [x] Delete `scripts/git_push.bat` (folded into `release.bat`)
* [x] Rewrite `scripts/release.bat` as the single release pipeline:
      compile exe → commit → push → merge into main if needed → tag +
      publish GitHub release with the exe attached
* [x] Verify each step's underlying command works (version parse, npm run
      package, gh auth/release lookup, artifact paths)
* [x] Update CHANGELOG, ticket memory

---

## Files Modified

- `scripts/download-electron.js` (deleted)
- `scripts/download-electron.ps1` (deleted)
- `scripts/fix-electron.bat` (deleted)
- `scripts/git_commit.bat` (deleted)
- `scripts/git_push.bat` (deleted)
- `scripts/release.bat` (rewritten)
- `CHANGELOG.md`
- `.claude/memory/ticket_memory.md`

---

## Testing

- Version parse (`node -e "...require(src/package.json).version"`) → `0.1.2`
- `npm run package` verified working earlier this session (TICKET-0040)
- `gh` 2.96.0 installed + authenticated; `gh release view v0.1.2` resolves,
  so the script correctly takes the upload-assets path
- Both expected artifacts exist in `releases/`
- Full live end-to-end run deferred: it is outward-facing (publishes a GitHub
  release) and a run against the current 0.1.2 would mislabel this chore commit
  as "Release v0.1.2". It will be exercised naturally on the next version bump.

---

## Result

Scripts folder reduced to: `setup`, `run`, `build`, `clear_cache` (each
`.bat` + `.sh`) plus the new single `release.bat`. `build.bat` was kept: it is
mandated by CLAUDE.md and serves the dev compile (`npm run build`, no
packaging), a distinct purpose from `release.bat`'s full exe pipeline.

Note found during verification: the existing v0.1.2 GitHub release only had the
installer asset (`Agent.Command.Engine.Setup.0.1.2.exe`) — the portable exe was
missing. `release.bat`'s publish step would add it.

---

## Closed

2026-08-11
