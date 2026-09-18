# TICKET-0153 — macOS prereq check reports Node.js missing when it's installed

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-18

---

## Description

Reported live: a friend installed ACE on macOS and Setup blocked further
install steps, reporting Node.js as not installed even though it genuinely
was.

---

## Reason

`prereqs:check` (`handlers.js`) spawns bare `node --version` with
`shell: false`, inheriting `process.env.PATH`. An app launched from
Finder/Dock (not a terminal) gets launchd's minimal default PATH
(`/usr/bin:/bin:/usr/sbin:/sbin`), not the interactive login shell's PATH
that `.zshrc`/`.zprofile`/`.bash_profile` build up — which is where Homebrew
(`/opt/homebrew/bin`), nvm, and other common Node install methods add
themselves. `GitPath.js` already solved exactly this class of problem for
git, but only for Windows (bundled MinGit); nothing did the equivalent for
macOS/Linux, so a GUI-launched ACE genuinely can't see a Node.js that a
Terminal on the same machine resolves fine. Same root-cause class as the
well-known `fix-path` npm package exists to solve for Electron apps.

---

## Implementation Plan

* [x] `ShellPath.js`: mirrors `GitPath.js`'s "mutate `env.PATH` once at
  startup" shape. Skips entirely on Windows (GUI apps there already inherit
  the full user PATH) and when `node` already resolves on the current PATH
  (the common case, no shell spawn needed). Otherwise spawns the user's own
  login shell (`$SHELL`, interactive + login flags so it sources the same rc
  files Terminal does) once, captures its PATH between two markers, and
  replaces `process.env.PATH` with it.
* [x] Wire `ensureShellPath()` into `main/index.js`, same spot and same
  defensive try/catch as `ensureGitOnPath` — before `ptyHost` is forked or
  anything else spawns a child process, so every spawn after this (prereq
  checks, agent terminals, git) inherits the fixed PATH.
* [x] Add `shell-path.test.js`, mocking `child_process.spawnSync` (same
  pattern `audit-regressions.test.js` already uses for `spawn`) rather than
  spawning a real shell — deterministic across CI runners.
* [x] `CHANGELOG.md`, node map.

---

## Files Modified

- `src/main/services/ShellPath.js` (new)
- `src/main/index.js`
- `src/tests/shell-path.test.js` (new)
- `CHANGELOG.md`

---

## Testing

- `node --test tests/*.test.js` (from `src/`): 126 passed, 1 skipped
  (POSIX-only), 0 failed. New `shell-path.test.js` mocks
  `child_process.spawnSync` — caught a real bug in the fix itself: the
  service originally destructured `spawnSync` at require time, which a
  test's `t.mock.method` patch on the module object can't reach (same
  pitfall as an earlier `HookService` fix this session); switched to calling
  `child_process.spawnSync(...)` inline.
- `npm run build`: renderer + main passed.
- Not yet verified live on the reporting friend's Mac — needs a fresh
  packaged build.

---

## Result

`ShellPath.js` mutates `process.env.PATH` once at startup, alongside the
existing `GitPath.js` call in `main/index.js`: skips on Windows and when
`node` already resolves (the common case), otherwise spawns the user's own
login shell once to capture its real PATH and replaces `process.env.PATH`
with it, so `prereqs:check` and every other spawn (agent terminals via
`TerminalService`/`ptyHost`, git) see the same PATH Terminal would.

---

## Notes

`ponytail:` replaces `process.env.PATH` wholesale with the login shell's
value rather than merging/deduping against the launchd default -- the
shell's own PATH is already a superset (rc files prepend onto the inherited
default), matching how `fix-path` itself does it. No new dependency added;
the whole fix is ~25 lines, so a small self-contained function beat pulling
in the npm package for this.

---

## Closed

---
