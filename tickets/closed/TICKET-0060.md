# TICKET-0060: Agents Fail to Launch on macOS/Linux (PATH) + Silent Launch Errors

**Type**: Bug
**Status**: Completed
**Created**: 2026-08-21
**Updated**: 2026-08-21

## Problem

Reported live: launching an agent does nothing — the terminal card shows a blank
prompt and the CLI never starts. Two distinct causes, plus a related env leak.

## Root Cause

1. **Minimal GUI PATH.** ACE spawns the real `claude`/`codex` CLIs; when the app
   is launched from Finder/Dock/Spotlight on macOS (or a desktop launcher on
   Linux), it inherits only a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`),
   missing `~/.local/bin`, Homebrew, nvm, volta, etc. The main-process
   `prereqs:check` (and any direct spawn) therefore reports the CLIs as missing
   even when they are installed and work fine in a terminal. The agent PTY only
   found them because node-pty spawns an *interactive* shell that re-sources the
   user's rc file — so main and the PTY disagreed on PATH.

2. **The launch error was invisible.** The launch command is *typed* into the
   PTY shell (`AgentTerminal.jsx`). If the binary is missing, the shell prints
   `command not found`, but the splash-hiding `term.clear()` (1200ms after
   launch, TICKET-0025) then wipes even that line — leaving a blank prompt
   indistinguishable from "nothing launched".

3. **`CLAUDE*` env leak.** When ACE is itself launched from a terminal with an
   active Claude Code session (`CLAUDECODE=1` etc.), those vars leaked into the
   PTY shell, making the nested `claude` treat itself as a sandboxed child
   session. `ptyHost.spawnSession` passed raw `process.env` (unlike the now-dead
   `AgentService.buildChildEnv`, which strips them).

## Solution

- **New `src/main/services/PathService.js`** — `applyLoginShellPath()` resolves
  the user's real interactive-login-shell PATH (`$SHELL -ilc 'printf …$PATH…'`,
  5s timeout, marker-wrapped so rc banners don't corrupt it) and merges it into
  `process.env.PATH` at startup, before the ptyHost fork and any `prereqs:check`.
  No-op on Windows (GUI processes inherit the full PATH there); fails open on any
  error (keeps the inherited PATH). Called from `index.js` at the top of
  `app.whenReady()`.
- **`ptyHost.js`** — `buildSessionEnv()` strips `CLAUDE*` vars from the spawned
  shell's env, mirroring `AgentService.buildChildEnv`.
- **`AgentTerminal.jsx`** — before typing the launch command, verify the chosen
  CLI is present via `prereqs.check()`. If it reports the CLI missing, print a
  clear, actionable error into the terminal and skip the splash-clear instead of
  wiping it. Fail open: if the check itself errors, launch anyway (the
  interactive shell may still resolve the CLI).

## Files Changed

- `src/main/services/PathService.js` (new)
- `src/main/index.js` — call `applyLoginShellPath()` before services init
- `src/main/ptyHost.js` — `buildSessionEnv()` strips `CLAUDE*`, used in spawn
- `src/renderer/components/AgentTerminal.jsx` — pre-launch CLI check + visible error
- `src/tests/path-service.test.js` (new) — `parseShellPath` / `mergePaths`

## Testing

- [x] `node --check` on all changed main-process files
- [x] `npm test` — 19/19 pass (4 new PathService cases)
- [x] `npm run build` clean
- [ ] Live in-app verification (packaged, Finder-launched): launch a Claude agent
      and confirm the CLI boots; launch with a CLI removed from PATH and confirm
      the visible error instead of a blank prompt. Requires a repackage — a
      main-process + startup change can't hot-reload into a running app.

## Note

The Codex CLI was also simply **not installed** on the reporting machine, which is
its own cause of "codex agent won't launch" independent of PATH — the new visible
error now surfaces that instead of failing silently. Install via Settings →
Prerequisites (`npm install -g @openai/codex`).
