# TICKET-0127 — ACE home in ~/Documents/ACE and a mandatory skill-download setup gate

**Status**

Awaiting verification

**Type**

Feature

**Priority**

High

**Created**

2026-09-05

---

## Description

Follow-up to TICKET-0125 (self-contained release audit). Two further ways a
shipped install reached outside itself, or hid state from the user:

1. **All writable state lived under `%APPDATA%` / `~/Library`.** `ace.db` (the
   SQLite store: project list, settings, agents, usage) and `ace-hooks/`
   (generated hook scripts, `settings.json`, `notification.wav`, `.muted`
   marker) sat under `app.getPath('userData')`. Nothing a user could find or
   back up.

2. **Three bundled skills are other people's work, shipped as silent copies.**
   `calibrate-enhanced` and `gauntlet-loop` (github.com/robonuggets),
   `token-analytics` (github.com/nateherkai/token-dashboard) each cite an
   upstream repo in their `SKILL.md` but shipped as vendored copies, so the
   authors got no clone traffic and no visible credit.

Both are now addressed:

- Everything ACE writes goes to `~/Documents/ACE/` (`app.setPath('userData', …)`
  before any consumer runs). An MSIX build with no Documents write access falls
  back to `~/.ace`. An existing install's `ace.db` is copied forward on first
  launch.

- On the first launch after an install or update, a modal gate (no window yet)
  asks the user to allow a one-time download. Declining quits ACE. On accept,
  each repo in `.claude/skill-sources.json` is `git clone --depth 1`d into
  `~/Documents/ACE/skills-cache/<name>` — the clone is what registers in the
  author's GitHub *Traffic → Git clones* insights — and a `THIRD_PARTY_SKILLS.md`
  credit table (skill, author, repo, commit, license) is written. One retry on
  failure, then a fall back to the bundled copies with a warning so a GitHub
  outage or a missing `git` can't brick the app. `ensureBundledSkills()` copies
  whatever landed in the cache (cache wins over the template copy) into each
  project's `.claude/skills/` at terminal spawn, along with the credit file.

---

## Reason

"Self-contained" for the user means two things: nothing important hidden in
AppData where they can't see or move it, and every skill a project uses
actually present out of the box. The download gate reconciles "self-contained"
with "credit the authors": the fetch happens once, with consent, and the app
then runs offline from the cache.

---

## Implementation Plan

* [x] `app.setPath('userData', ~/Documents/ACE)` before any consumer, with an
  `~/.ace` fallback and a one-time `ace.db` copy-forward

* [x] `SkillSetupService.ensureSkillsProvisioned()` — marker check, mandatory
  consent dialog, clone loop, one retry, bundled fallback, attribution file

* [x] `.claude/skill-sources.json` manifest (repo, ref, subdir, author,
  license); `subdir: null` = clone for credit only, keep the bundled body

* [x] `ensurePushUpdateSkill()` → `ensureBundledSkills()`: installs every
  missing skill from the cache first, then the template; carries
  `THIRD_PARTY_SKILLS.md` into the project

* [x] `getScaffoldDir()` moved to `ProjectScaffoldService` and shared

* [x] Gate wired into `app.whenReady()` before `createWindow()`

---

## Files Modified

- `src/main/index.js` — userData relocation + db migration; gate call
- `src/main/services/SkillSetupService.js` — new
- `src/main/services/ProjectScaffoldService.js` — `getScaffoldDir()`,
  `ensureBundledSkills()` (replaces `ensurePushUpdateSkill()`)
- `src/main/ipc/handlers.js` — import `getScaffoldDir`/`ensureBundledSkills`;
  `terminal:spawn` passes the skills-cache dir
- `src/main/project-template/.claude/skill-sources.json` — new
- `src/tests/project-scaffold.test.js` — `ensureBundledSkills` coverage
- `CHANGELOG.md`, `README.md`

---

## Testing

- `cd src && npm test` — 74 tests, 73 pass, 1 skipped (POSIX-only chmod on
  Windows), unchanged from before
- `cd src && npm run build:main` — clean; `dist/main` loads both new/changed
  services

Still to verify live:
- packaged build with an existing `%APPDATA%` db → first launch shows the
  consent dialog; **Quit** closes with no window; relaunch → **Download and
  continue** populates `~/Documents/ACE/{ace.db,ace-hooks,skills-cache,
  THIRD_PARTY_SKILLS.md,.skill-setup-version}` and writes nothing new to
  `%APPDATA%`
- relaunch same version → no dialog
- bad `repo` URL in the manifest → Retry/Quit, then the bundled-fallback
  warning and the app opens
- terminal in a project ACE did not scaffold → its `.claude/skills/` gains the
  three skills and the credit file
- each upstream repo owner sees a clone in *Insights → Traffic*

---

## Result

---

## Notes

- Repo layouts differ: `calibrate` has `SKILL.md` at root (`subdir: "."`);
  `gauntlet-loop` keeps it at `.claude/skills/gauntlet-loop`; `token-dashboard`
  is a Python app with no `SKILL.md`, so `subdir: null` — the clone credits the
  author and ACE keeps its own `token-analytics` body.
- `gauntlet-loop` is CC-BY-4.0, not MIT; the credit table carries the real
  license.
- The old `%APPDATA%` `ace.db` is copied, not moved — left in place as a safety
  net. A later build can delete it.
- MSIX `git` spawn from inside the sandbox is untested; the retry→fallback path
  covers it if it fails.

---

## Closed
