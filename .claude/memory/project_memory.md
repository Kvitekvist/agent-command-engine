# Project Memory

## Project Name
Agent Command Engine (ACE)

## Project Vision
A specialized Electron desktop application that provides a powerful interface for managing Claude (and OpenAI Codex) AI agents across multiple projects. The goal is to benchmark different project frameworks by tracking speed, token usage, and documentation quality — while keeping a full audit trail of every prompt and response for reproducibility.

---

## Current Milestone
**Milestone 2 — Reliability Alpha**
Make process execution, persistence, packaging, and provider behavior dependable.

---

## Active Priorities
* Verify the TICKET-0071 `cpi` → `ace` internal rename live: launch against
  a userData profile with an old `cpi.db` present and confirm it's renamed
  to `ace.db` on startup with all data intact; capture a screenshot in a
  project still holding a `.cpi/screenshots/` folder and confirm it's
  renamed to `.ace/` with the new screenshot landing there and `.gitignore`
  updated to `.ace/` — deferred for a real app restart, same reason as
  TICKET-0024/0025/etc.
* Verify the TICKET-0070 auto-title feature live: launch an agent, type a
  first prompt, confirm the card's label updates from its random default to
  a short derived title; switch tabs/projects away and back and confirm the
  title persists; stop and relaunch (or restart the app) after a title was
  already set and type a follow-up line, confirming it does NOT re-title
  the card (the `agents.title_set` guard) — implemented, build/tests clean,
  not yet live-verified in a running app (see ticket_memory.md)
* TICKET-0043 (closed 2026-08-11): fixed the user's "can't type the new-
  project name" report. It was NOT a renderer bug — the input is correct and
  the packaged build accepts keys fine when driven over CDP (proven, incl.
  with a running agent's xterm; the "terminal steals focus" theory was
  disproven). Real cause: no `app.requestSingleInstanceLock()`, so a second
  ACE window could be open and Windows sent real keystrokes to whichever
  window held OS focus, not the one being clicked. Now single-instance (a
  second launch focuses the existing window); also closes the two-instances-
  one-cpi.db corruption risk noted in [[architecture]] Gotchas. User
  confirmed the discriminators (typing works elsewhere; one-window fixes it);
  build clean, tests 12/12, lock verified live with two shared-profile
  launches. **Still worth a user confirmation in their own normal workflow**
  (i.e. that they no longer end up unable to type after their usual multi-
  window habits) once they run a build containing this fix.
* TICKET-0039 (closed 2026-08-11): auto-answer permission prompts, fixed and
  **live-verified end-to-end by the user directly** — a single initial
  prompt drove a real WebFetch, Web Search, second Fetch, and local save to
  completion with zero manual clicks. Three stacked bugs across two passes
  the same day, the third one the actual explanation for the user's
  original screenshot: (1) spawn-time-only setting + no retry on a dropped
  keystroke, (2) detection pattern hardcoded to the literal word "Yes"
  (missed a real "❯ 1. Allow" browser-tool prompt), (3) the real app
  renders the selection arrow as plain ASCII `>`, not the fancy Unicode `❯`
  fix #2 still required — found by reading file-based debug logging after
  the user reproduced it live in their own already-open app, since a
  live-agent-spawn test harness and a PowerShell desktop-automation attempt
  were both correctly blocked by Claude Code's own auto-mode safety
  classifier (see feedback_safety_classifier_is_a_real_boundary.md in
  user-scope memory). Pattern now matches both glyphs. Per follow-up user
  requests once confirmed working: removed the manual "Approve now" button,
  removed the global Settings toggle entirely (auto-answer is now purely a
  per-agent live pill, off by default, no spawn-time setting at all), and
  removed the Safe/Guarded/Auto permission-mode selector (new agents launch
  fixed at `safe`). Full story in ticket_memory.md. Worth remembering
  generally: a detection pattern captured against one real example doesn't
  generalize until tested against more than one real prompt shape or
  rendering mode — this happened three times on one feature before it
  actually held up under live testing.
* TICKET-0031 (in-chat model switcher, promoted from `WISHLIST.md`) is the
  only open ticket not yet started — everything else open is implemented
  and committed, awaiting only manual verification (see below) or, for
  TICKET-0035, still in progress
* TICKET-0015 (.NET migration) remains flagged as stale/unverifiable — its
  Result section claims a scaffolded .NET 8 solution, ported DbService/
  AgentService, and a working WPF shell, but the repo has no `.sln`/
  `.csproj` anywhere and `app/` (its stated home) contains only a
  `.gitkeep`. Ask the user whether to discard or restore before resuming
* Verify the TICKET-0033 file-tree context menu live: right-click a
  regular file (Open, Open in Explorer only) and a runnable file like
  `.bat`/`.exe`/`.ps1` (Run also present), confirm Explorer actually
  opens/highlights the file and Run actually launches it — needs an app
  restart since `handlers.js`/`preload.js` are main-process changes,
  deferred for the same reason as TICKET-0024/0025/etc.
* Verify the TICKET-0034 screenshot rework live: click 📸 on a running
  agent, drag-select a region (including one covering ACE's own window),
  confirm the PNG lands under `<project>/.ace/screenshots/`, `.gitignore`
  gained a `.ace/` entry, Esc/right-click cancels cleanly, and the copied
  path pastes correctly into that agent's terminal
* Finish manually verifying the file explorer/editor (TICKET-0021): an
  actual Save through Monaco's own keyboard input (write path itself was
  verified directly via IPC, not through simulated typing), tab-switching
  preserving independent undo history, and a real large/binary file
* Finish manually verifying the per-agent embedded terminal (TICKET-0019
  correction): confirm a launched Codex agent boots correctly too now
  that TICKET-0020 fixed its CLI invocation, type a follow-up prompt
  directly into a running terminal and confirm it responds, get a real
  pixel screenshot of the CLI banner rendering
* Verify the TICKET-0030 fix live: launch an agent, type a follow-up
  prompt so there's real scrollback, switch to a different project and
  back, confirm the same session (scrollback intact, no relaunch) is
  still there instead of a fresh CLI process
* Live token usage (TICKET-0022) now covers real usage tracking
  regardless of headless vs. embedded-terminal agents — ACE's own
  `prompts` DB table (Audit Log + the historical Token Usage section) is
  still frozen for new agents, but that's now a documented, accepted
  trade-off rather than an open "rebuild tracking" priority; only worth
  revisiting if per-turn audit rows specifically (not just aggregate
  usage) turn out to matter again
* Verify restored stopped-agent behavior manually (TICKET-0011)
* Verify the TICKET-0024 duplicate-agent fix live: switch away from the
  Agents tab and back with a running agent present, confirm exactly one
  card and one terminal process (deferred during the fix itself since the
  dev window had real in-progress agent sessions on another project — see
  TICKET-0024 Testing)
* Verify the TICKET-0025 splash-hiding overlay live: launch a new agent
  and confirm the CLI's own startup banner is not left visible (a brief
  flash before the overlay clears is expected and fine) — deferred for
  the same reason as TICKET-0024
* Verify the TICKET-0026 Codex model-list fix live — needs an actual app
  restart (the follow-up DB migration is a main-process change sql.js
  only applies at `DBService.init()`, same HMR caveat as TICKET-0027/29):
  confirm a previously-broken existing Codex agent (e.g. "Omar") now
  launches and completes a prompt without "model not supported", and
  that a freshly-created Codex agent does too
* Verify the TICKET-0028 fix live: run several agents in one project,
  switch to a different project, confirm ptyHost.js doesn't crash (no
  `terminal:hostRestarted` event / "terminal process was lost" message)
* Verify the TICKET-0027 fix live: this needs an actual app restart to
  take effect (the `TerminalService.js` half is a main-process change,
  which Vite's dev HMR never picks up — see architecture.md's `npm run
  dev` gotcha), deliberately not forced yet since the running dev window
  had real in-progress agent sessions. Once restarted: confirm no console
  window appears when switching tabs, and that switching away from Agents
  and back keeps the same terminal session (scrollback intact) instead of
  relaunching every running agent's CLI
* Verify the TICKET-0029 fix live (needs an app restart, same main-process
  HMR caveat as TICKET-0027): leave the app open and idle for a few
  minutes and confirm the two periodic external cmd.exe window flashes
  are gone, and that the Token Usage tab / Agents-tab usage bar still
  show real numbers
* Add end-to-end provider contract tests for Claude and Codex
* Replace whole-database export-on-write if audit volume causes UI stalls

---

## Supported Platforms
- Windows (x64) — portable + NSIS installer
- macOS (x64 + arm64) — dmg

---

## Tech Stack
- Electron (main process)
- React 18 + Tailwind CSS (renderer process)
- Vite (bundler for renderer)
- sql.js (local SQLite database persisted in Electron userData)
- Recharts (token usage visualization)
- Node.js child_process (spawn claude CLI and openai codex CLI)
- tokscale (reads Claude Code's/Codex's own local session transcripts for accurate token/cost usage — see [[architecture]] Token Tracking — and, via its own `usage`/`--today` subcommands, powers the live Token Usage dashboard and the Agents tab's compact quota bar, both reading one shared 60s poll — see [[architecture]] Live Token Usage Dashboard)
- node-pty + xterm.js (real interactive terminal embedded per agent card, forked into its own `ptyHost.js` process — see [[architecture]] Terminal)
- Monaco editor (`@monaco-editor/react`, pinned `monaco-editor@0.50.0`, `vite-plugin-monaco-editor-esm`) — VS Code-style file explorer + editor per project, see [[architecture]] File Explorer / Editor

---

## Technical Debt
- `package.json` lives in `src/`, not the repo root — `node_modules` is at
  `src/node_modules`. Scripts/tests that shell out to `node` need to run from
  `src/` (or reference `src/node_modules`) or `require('electron')` etc. won't
  resolve.

---

## Known Issues
- TICKET-0019 (per-agent embedded terminal — every launched agent's card is
  now a real interactive `claude`/`codex` terminal, not a headless chat
  thread; the original standalone floating panel was removed) is verified
  at the process level and via live-window DOM/IPC automation: PTY host
  forks and reports ready, a standalone spike confirmed the shell's real OS
  process is actually killed (not just IPC-resolved) on graceful shutdown,
  and driving a real dev window over the Chrome DevTools Protocol confirmed
  launching an agent produces a card with a live terminal and no leftover
  chat UI, and Stop actually disposes that terminal's PTY session. Still
  open: a pixel-level screenshot check that the CLI banner renders, testing
  a Codex agent specifically, and typing a follow-up prompt into a running
  terminal.
- Terminal sessions do not survive an app restart — a PTY session is a
  real OS process owned by `ptyHost.js`, which dies with the app, and
  there's nothing to reconnect to on next launch. They now survive both
  switching *tabs* away and back (TICKET-0027) and switching *projects*
  away and back (TICKET-0030) — `AgentView` keeps every agent's card
  mounted (for every tab, and for every project visited this session),
  toggling visibility with CSS instead of unmounting, so nothing gets torn
  down until Stop, Delete, or the app quits. Before TICKET-0027, tab
  switches used to respawn every running agent's session (and, on Windows,
  could pop up a visible console window per spawn); before TICKET-0030,
  project switches used to do the same via the `agents` store array being
  reset on every `setActiveProject` call.
- TICKET-0028: ptyHost.js crashed with a native access violation while
  switching projects with multiple agents running — killing more than one
  ConPTY session concurrently (every AgentTerminal's dispose firing at
  once on the project-switch unmount) is a known crash trigger for
  node-pty's native Windows addon. Fixed by serializing session teardown
  behind a promise queue in ptyHost.js so kills never overlap. Only
  observed once live; not reliably reproducible on demand, so live
  re-verification is still open — see Active Priorities.
- TICKET-0027: switching tabs away from Agents and back showed visible
  console/cmd windows and restarted every running agent's CLI session,
  sometimes appearing to trigger more than once for the same agent. Two
  causes: `TerminalService`'s fork of `ptyHost.js` was missing
  `windowsHide: true` (Windows shows a console window for a forked
  `node.exe` by default when spawned from a windowed parent like
  Electron), and `AgentView` unmounted/remounted on every tab switch,
  which killed and re-spawned every running agent's PTY session each
  time. Both fixed; live re-verification needs an app restart, deferred
  for the same reason as TICKET-0024/0025/0026 (see Active Priorities).
- Audit Log / Token Usage no longer gain new rows for agents launched via
  the embedded terminal (only the old headless path wrote them, and
  nothing calls it anymore) — historical data still displays correctly.
  See TICKET-0019 Notes and [[architecture]] Token Tracking.
- TICKET-0020: Codex agents couldn't launch at all — both the headless
  path and the new embedded terminal spawned `openai codex ...`, but
  `openai` on PATH is the unrelated openai-python SDK CLI (no `codex`
  subcommand), not the real Codex CLI (`codex`, npm package `codex-cli`).
  Fixed both call sites and confirmed the corrected flags parse cleanly
  against the real installed CLI; re-driving it through a live agent card
  in the running app is still open.
- TICKET-0026: even after TICKET-0020, Codex agents launched but failed on
  their first prompt — `CODEX_MODELS` (`codex-mini-latest`/`o3`/`o4-mini`)
  are raw API-key-only model slugs, and this machine's Codex CLI is logged
  in via a ChatGPT subscription, which rejects all three outright. Found
  live in a running agent card. Replaced with ChatGPT-account-compatible
  slugs read from `~/.codex/models_cache.json`. Follow-up: that alone
  didn't fix already-created agents, since the bad slug was already saved
  on their DB row and every relaunch kept reading it straight from there,
  bypassing the corrected dropdown — confirmed by querying `cpi.db`
  directly and finding four agents still on `codex-mini-latest`. Added a
  one-time migration in `DBService._migrateSchema()` to repair those rows;
  takes effect on next app restart. Re-verifying live (restart + confirm a
  previously-broken agent launches cleanly) is still open.
- TICKET-0029: two external cmd.exe console windows briefly flashed on
  Windows roughly once a minute, even with the app idle and no agents
  running — traced to the 60s live-usage poll's two `tokscale` calls
  (`getQuota`/`getTodayBreakdown`), specifically to a third-party bug:
  `tokscale`'s own JS shim (`@tokscale/cli/dist/index.js`) resolves the
  native `tokscale.exe` binary and runs it via its own nested
  `spawnSync(..., { stdio: "inherit" })` with no `windowsHide` — a
  grandchild spawn our own (correctly hidden) outer spawn can't reach.
  This app's own spawn/fork sites were all already correct (including
  TICKET-0027's fix). Fixed by having `TokscaleService` resolve and spawn
  the `@tokscale/cli-win32-{x64,arm64}-msvc` binary directly on win32,
  bypassing the vendor shim (and its un-hidden nested spawn) entirely;
  non-Windows unchanged. Live idle-app re-verification still open — see
  Active Priorities.
- TICKET-0011 (restore stopped agents + Delete button) is implemented but its
  manual UI verification step (stop an agent, switch projects, confirm cards +
  history reappear) hasn't been run yet.
- TICKET-0021 (file explorer + Monaco editor per project, in the Sidebar)
  is verified for reading (tree → open → real Monaco rendering, confirmed
  live) and for writing/security (writeFile/readFile round trip, `..`
  path-traversal correctly rejected, confirmed live). Getting Monaco
  building at all needed two workarounds — `monaco-editor` pinned to
  `0.50.0` (newer versions' package.json `exports` map breaks the Vite
  plugin's worker path resolution) and `vite.renderer.config.mjs`'s
  `build.outDir` changed to relative (the plugin's own output-path join
  assumes a root-relative `outDir`) — see TICKET-0021 Notes if touching
  this again. An actual Save via real Monaco keystrokes, multi-tab undo
  history, and a real large/binary file are still open.

---

## Future Ideas
- Framework benchmark scoring (auto-compare project templates)
- Replay a past prompt/response sequence to reproduce results
- Export audit log to CSV/JSON
- Cost alerts when spending exceeds threshold

---

## Notes
- User has Claude Code CLI and OpenAI Codex CLI installed
- Load balance: route to Codex when Claude credits are exhausted
- All token counts parsed from CLI stdout (JSON output mode)
- One SQLite DB for the application in Electron's userData directory
- Current template project: the AI Project Bootstrap in this repo
- User has a separate reference project, `token-monitor`, checked out at
  `C:\Users\jensr\Documents\VS Projects\token-monitor-main` — an Electron
  live token/cost widget for Claude Code/Codex, also built on `tokscale`.
  Source of the design TICKET-0022's live usage dashboard is based on;
  worth checking again for any future tokscale/usage-tracking work
