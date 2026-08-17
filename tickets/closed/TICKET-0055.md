# TICKET-0055: In-app Claude/Codex CLI prerequisite check + installer

**Status:** Closed
**Priority:** Medium
**Created:** 2026-08-17
**Closed:** 2026-08-17

---

## Issue

User asked for the installer to "install all the pre-requisites for everything
to work... setup claude and codex requirements so its true plug and play for
mac and windows." ACE spawns the real `claude`/`codex` CLIs directly
(`AgentService.js`, `agentLaunch.js`'s `buildLaunchCommand`) — if they aren't
on PATH, every agent launch just fails. Currently there is no check for this
anywhere; a fresh machine with ACE installed but no CLIs gives no useful
guidance.

Asked the user where this should live (installer-time vs first-run vs fully
offline-bundled) — see conversation. Chosen approach: **first-run check
inside ACE itself**, not baked into the NSIS/dmg installer. Reasoning:
visible and consensual (the user sees exactly what's being installed and
clicks a button, rather than a silent installer step), doesn't need internet
access or elevated privileges at install time, re-runnable anytime from
Settings, and doesn't touch the electron-builder config at all. Deliberately
does **not** attempt to auto-install Node.js itself — that's a much bigger,
more consequential system change than installing two CLI npm packages, so
the setup screen links out to nodejs.org and lets the user handle that step
themselves, same as any other dev-tool prerequisite.

---

## Requirements

* [x] Detect presence + version of `node`, `npm`, `claude`, `codex` on PATH
* [x] One-click install of the Claude Code CLI (`npm install -g
      @anthropic-ai/claude-code`) and Codex CLI (`npm install -g
      @openai/codex`) — the exact packages this machine already has
      installed, confirmed via `npm ls -g`
* [x] Works on both Windows (`.cmd` shims, needs `shell:true` for
      npm/claude/codex per the existing AgentService.js/handlers.js
      convention) and macOS/Linux (real executables, `shell` mostly a no-op)
* [x] Shown automatically on launch when `claude` or `codex` is missing,
      dismissible ("Continue to ACE" + optional "Don't show this again",
      persisted via the existing `settings` key/value table)
* [x] Also reachable anytime from Settings (not just first-run), for a
      machine where a CLI got uninstalled/broken later
* [x] Does NOT attempt to install Node.js itself — links to nodejs.org
      instead
* [x] Does NOT attempt to automate `claude login`/`codex login` — that's an
      interactive OAuth flow; the setup screen just tells the user to run it
      themselves (in any terminal, or inside an ACE agent terminal once one
      is open)

---

## Implementation Plan

1. `src/main/ipc/handlers.js`: add `prereqs:check` (spawns `--version` for
   each of node/npm/claude/codex, resolves `{present, version}` per tool),
   `prereqs:install` (spawns `npm install -g <pkg>`, buffers output, resolves
   `{ok, message}`/`{ok:false, error}` with an EACCES-specific hint on
   failure — same shape as the existing `project:build`/`git:pull`
   handlers), and `prereqs:openNodeDownload` (`shell.openExternal`).
2. `src/main/preload.js`: expose `window.cpi.prereqs.{check, install,
   openNodeDownload}`.
3. Extract `AgentTerminal.jsx`'s module-local `OperationFeedback` component
   and `runOperation` helper into shared files
   (`components/OperationFeedback.jsx`, `utils/runOperation.js`) so the new
   setup UI reuses the exact same loading-bar/success/error pattern instead
   of duplicating it.
4. New `components/PrereqChecklist.jsx`: the actual status rows + install
   buttons, reusable both full-screen and inline.
5. New `views/SetupView.jsx`: full-screen wrapper around
   `PrereqChecklist` with a short explanation + Continue/dismiss controls.
6. `App.jsx`: on mount, check `prereqs_setup_dismissed` setting; if not set,
   run `prereqs:check` and gate the whole app behind `SetupView` when
   `claude` or `codex` is missing.
7. `SettingsView.jsx`: new "Prerequisites" card section rendering
   `PrereqChecklist` inline, for re-running anytime regardless of dismissal.

---

## Files Modified

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/OperationFeedback.jsx` (new, extracted)
- `src/renderer/utils/runOperation.js` (new, extracted)
- `src/renderer/components/AgentTerminal.jsx` (uses the extracted versions)
- `src/renderer/components/PrereqChecklist.jsx` (new)
- `src/renderer/views/SetupView.jsx` (new)
- `src/renderer/App.jsx`
- `src/renderer/views/SettingsView.jsx`

---

## Testing

* [x] `npm run build` clean, `npm test` still passing
* [x] Live: real dev app on this Windows machine (node/npm/claude/codex all
      already installed) does NOT show the setup gate on launch
* [x] Live: `prereqs:check`'s detection logic correctly reports
      `present:false` when a tool isn't on PATH (simulated via a restricted
      PATH, not by touching the real claude/codex installs on this dev
      machine)
* [x] Live: `prereqs:install`'s spawn/buffer/exit-code mechanics verified
      against a real, safe, disposable npm package (installed then
      immediately uninstalled) rather than reinstalling the real
      claude-code/codex packages unprompted
* [x] Settings → Prerequisites section renders and re-checks correctly
* macOS not testable from this Windows machine — flagged as a known gap

---

## Result

**Live-verified**, not just build+tests, per this project's standing rule that
runtime-behavior claims need a real repro:

1. **Backend spawn logic** (the part with real OS-level risk) — verified with
   standalone scripts mirroring `handlers.js`'s exact spawn/shell code:
   - `prereqs:check` against the real environment correctly reported all four
     (`node` v24.16.0, `npm` v11.17.0, `claude` v2.1.233, `codex` v0.147.0) as
     present — matching this machine's real `npm ls -g` exactly.
   - The same check against an artificially restricted `PATH`
     (`C:\Windows\System32` only) correctly reported all four as
     `present:false` — proving the "missing" detection path works, without
     touching the real installs.
   - `prereqs:install`'s spawn/buffer/exit-code mechanics verified against a
     real, disposable, side-effect-free npm package (`is-odd`): installed
     successfully, immediately uninstalled afterward, `npm ls -g` confirmed
     back to exactly the original three packages.
   - The failure path verified too: installing a deliberately nonexistent
     package name correctly surfaced npm's real 404 error message, tail-sliced
     to the last 5 lines, matching `project:build`'s established convention.
2. **Full GUI integration** — launched the real dev app
   (`npx electron . --remote-debugging-port --user-data-dir=<throwaway>`,
   same isolated-profile technique TICKET-0043 established for this exact
   project) and drove it via a raw CDP client (Node's built-in global
   `WebSocket`, no new dependency): confirmed the app loads straight into the
   normal Token Usage dashboard with **no** setup gate (since claude/codex are
   both present), then clicked the real Settings button and confirmed the new
   Prerequisites section renders all four rows as "✓ Installed" with the
   correct live-detected versions.
3. Found and fixed one live bug during that GUI check: `claude`/`codex`
   `--version` print their own label text (e.g. `codex-cli 0.147.0`), not
   plain semver like node/npm — the UI's `v${version}` prefix produced an
   ugly `vcodex-cli 0.147.0`. Fixed by not prefixing an extra "v" for those
   two rows; confirmed the fix live via Vite HMR in the same running instance
   before rebuilding.
4. Terminated only the throwaway Electron instance + its Vite dev server
   afterward (found via the PID actually bound to the debug port, per
   TICKET-0043's guidance — never a blanket `taskkill`), leaving the user's
   real environment untouched throughout.

macOS is not testable from this Windows machine — the `shell: process.platform
=== 'win32'` branches are unexercised there; flagged as a known gap.

---

## Notes

- Deliberately did NOT add a streamed-output IPC channel for `npm install`
  progress — considered it, then cut it: the final UI only shows a loading
  bar + a settled result line (matching every other direct/no-AI action in
  this app, e.g. Commit & Push, Build), so there was nothing to stream to.
  `prereqs:install` buffers and resolves once at close, same shape as
  `project:build`/`git:pull`.
- Extracted `AgentTerminal.jsx`'s module-local `OperationFeedback` component
  and `runOperation` helper into `components/OperationFeedback.jsx` /
  `utils/runOperation.js` so this feature reuses them instead of duplicating
  ~40 lines — `AgentTerminal.jsx` now imports both instead of defining them
  locally, with zero behavior change (verified: its three existing call
  sites — Commit & Push, Pull, Build — needed no changes).
- On macOS, `npm install -g` commonly fails with `EACCES` if Node was
  installed via the official pkg installer (global prefix defaults to
  `/usr/local`, not user-writable). Not silently worked around (no embedded
  `sudo`) — the error surfaces with a hint pointing at npm's own EACCES
  troubleshooting docs and a `sudo npm install -g <pkg>` suggestion, visible
  and actionable rather than a mysterious failure.
