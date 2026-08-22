# Project Architecture

## Overview
Agent Command Engine (ACE) is an Electron desktop application with a React renderer. The main process manages child processes (AI CLI tools), the SQLite database, and file system access. The renderer provides the React UI. IPC channels bridge the two.

---

## Components

### User Interface (Renderer — React + Tailwind)
- **Sidebar**: project list, switcher, active project indicator, and a
  file tree scoped to the active project (TICKET-0021) — see File
  Explorer / Editor below
- **Agent Pane**: one card per launched agent, each embedding a real
  interactive terminal (TICKET-0019) — see Terminal below. A compact
  **Usage Bar** (TICKET-0023) sits above the toolbar: % used, % available,
  and reset countdown per provider, from the same live quota data as the
  Token Usage tab — see Live Token Usage Dashboard below
- **Editor View** (TICKET-0021): tabbed Monaco editor for files opened from
  the Sidebar's tree — see File Explorer / Editor below
- **Audit Log View**: searchable table of all prompts + responses (historical
  only as of TICKET-0019's correction — see Terminal)
- **Token Dashboard** (Token Usage tab, the app's **default tab** as of
  TICKET-0022): a live per-provider usage dashboard (see Live Token Usage
  Dashboard below) on top, with the original Recharts historical charts
  (per prompt/task/project; historical only as of TICKET-0019's
  correction — see Terminal) kept underneath, relabeled as DB-scoped
  history
- **Optimization Advisor**: triggered by button; analyzes recent prompts, returns suggestions
- **Settings**: default model, load-balance threshold

### Main Process (Node.js / Electron)
- Manages child processes for `claude` CLI and `openai` CLI
- Reads/writes SQLite via sql.js (WASM SQLite, not better-sqlite3 — see Dependencies)
- Handles file system dialogs (project folder picker)
- Exposes IPC handlers to renderer

### Database (SQLite — cpi.db in Electron userData)
- `projects` — id, name, path, created_at
- `agents` — id, project_id, label, provider, model, status
- `prompts` — id, agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, duration_ms, created_at
- `agent_sessions` (TICKET-0044) — session_id, agent_id, project_id, label, created_at. Maps a Claude CLI session id (forced via `claude --session-id <uuid>` at launch) back to the ACE agent that owns it, so the Token Usage "By Agent" breakdown can name tokscale's per-session rows. One row per launch (an agent spans many sessions over its life); `label` is snapshotted so a rename/delete doesn't lose history.
- `settings` — key, value

### Token Tracking (TICKET-0018)
**As of TICKET-0019's correction, this whole pipeline only fires for
`AgentService.sendPrompt` calls, which the UI no longer makes** — agents
launched via the per-agent embedded terminal (see Terminal below) run the
real interactive CLI directly, bypassing this headless path entirely, so
no new `prompts` rows or reconciled token/cost figures are generated for
them. Kept below as-is (still fully functional, still reads correctly for
historical rows) since nothing calls it, not because it's still the active
path for new agents.

Two-phase per turn, so tokscale's ~1-2s subprocess spawn never delays the
response the user is waiting on:
1. **Fast path (synchronous, unchanged from TICKET-0012/0013)**: `AgentService`
   parses Claude's `stream-json` `result` event for `input_tokens`/
   `output_tokens` and writes them immediately via `DBService.updatePromptTokens`.
2. **Reconciliation (async, fire-and-forget)**: once the fast path's
   `agent:prompt-done` fires, `AgentService._reconcileTokens` calls
   `TokscaleService.getUsageMap(['claude'])`, which spawns `tokscale --json
   --client claude --group-by client,session,model` and reads Claude Code's
   own local session transcript (`~/.claude/projects/**/*.jsonl`) — the
   authoritative source, including cache tokens and real cost, that Claude's
   own CLI never streams over stdout. The returned per-session cumulative
   totals are matched against the agent's own Claude session id (the same
   id captured via `parseSessionId`), diffed against a per-agent baseline
   (`computeTokscaleDelta`) to get this turn's real delta, and applied via
   `DBService.updatePromptUsage` once it resolves. Result: the fast path
   still logs a same-turn best guess, and it gets silently corrected to the
   real figures moments later.
- **Codex is not reconciled.** ACE spawns `codex exec` stateless (no
  `resume`), so there is no stable per-turn session id to match a tokscale
  row against — matching by "most recently written codex session file"
  would misattribute tokens whenever two Codex agents finish close together,
  which this app's multi-agent design allows. Codex token counts stay at
  the (inaccurate) stdout-parsed value, effectively always `0` today, until
  a future ticket gives codex real session resumption. (Also: this whole
  headless path is unused by the UI as of TICKET-0019 anyway — see above.)
- **The `prompts`-table history has been fully retired from the UI
  (TICKET-0044).** The Token Usage tab's "History (this project)" section
  no longer reads `tokens:getStats`/`prompts` at all — see "Project History"
  below. The headless pipeline and its DB columns remain only for any
  pre-existing rows and the Audit Log.

### Project History (Token Usage → "History (this project)", TICKET-0044)
Replaces the dead `prompts`-table source with real, tokscale-sourced usage
scoped to the active project — the fix the TICKET-0019 note anticipated
("reconcile against tokscale's session transcripts directly, without the
headless path"):
- **`TokscaleService.getWorkspaceReport(workspaceKey, clients)`**: runs
  `tokscale report --json --no-summarize --workspace <key> --client <c>` once
  per client (report's `--client` is singular — comma-separated values return
  nothing — so it's called per client and merged). Returns per-session rows,
  each with real `total_input_tokens`/`total_output_tokens`/`total_cache_read`/
  `total_cost`, `message_count`, `models_used[]` and a `created_at` epoch-ms
  timestamp. `report` is the only tokscale mode that carries a per-session
  date and session id; the `--group-by` modes don't. `--no-summarize` skips
  the optional LLM titling so it's a pure, ~0.5s data read.
- **`TokscaleService.pathToWorkspaceKey(path)`**: `path.replace(/[^a-zA-Z0-9]/g,
  '-')` — the inverse of tokscale's workspace-key flattening, verified against
  a real key. Maps `activeProject.path` to the `--workspace` filter.
- **IPC `tokens:getProjectHistory({projectId, projectPath})`**: derives the
  workspace key, fetches the report rows (claude + codex), joins each to
  `DBService.getAgentSessionMap(projectId)` for the owning agent's name
  (missing → "Untracked"), and returns a normalized flat row list. The
  renderer (`TokenView.jsx`) aggregates it into Totals, By Day (bucketed by
  `created_at`'s local calendar day), By Model (`models_used` joined for the
  rare multi-model session), and By Agent.
- **By Agent attribution** relies on ACE forcing a known session id per Claude
  launch: `AgentTerminal.jsx` generates a UUID, injects it via
  `buildLaunchCommand(agent, sessionId)` → `claude --session-id <uuid>`
  (behaviour-neutral — each terminal mount already started a fresh session),
  and records it through `agents:recordSession` into `agent_sessions`. Codex
  has no equivalent flag and isn't reconciled, so Codex sessions (and anything
  from before this shipped) appear under "Untracked".

### Live Token Usage Dashboard (TICKET-0022)
The Token Usage tab's primary content (and the app's default tab) — real
subscription usage, sourced live from the `tokscale` binary rather than
ACE's own `prompts` table, so it stays accurate regardless of whether an
agent ran through the old headless path or the new embedded terminal:
- **`TokscaleService.getQuota()`**: runs `tokscale usage --json`, tokscale's
  own subcommand for real subscription quota — reads the same local OAuth
  credentials Claude Code/Codex already use, so ACE never touches auth
  tokens itself. Returns `[{provider, plan, metrics: [{label, used_percent,
  resets_at}]}]` — Claude reports `Session` (its 5-hour rolling limit) and
  `Weekly`; Codex reports `Weekly` only.
- **`TokscaleService.getTodayBreakdown(clients)`**: runs `tokscale --json
  --today --client <clients> --group-by workspace,model`, then rolls the
  returned rows (which carry both `model` and `workspaceLabel`) up
  client-side into a Models breakdown and a Today-by-project breakdown from
  one call. Per-row token total = `input + output + cacheRead + cacheWrite`
  (`rowTokenTotal`) — `reasoning` is deliberately excluded since Codex
  already counts reasoning tokens inside `output`, so adding them again
  would double-count (confirmed against the reference app's own formula,
  see TICKET-0022 Notes).
- **`tokens:getLiveUsage`** (IPC handler, `handlers.js`): calls both above
  and combines them into `{ claude: {...}, codex: {...} }`. Quota and
  breakdown are fetched independently and each provider's failure is
  isolated (`quotaError`/`breakdownError` on that provider's object) so one
  provider being logged out doesn't blank out the other.
- **`UsageCard.jsx`**: one provider card — icon (real SVG asset,
  `assets/icons/claude.svg`/`codex.svg`, copied from the reference app
  `token-monitor`, masked with `currentColor` via inline `dangerouslySetInnerHTML`
  since Vite's `?raw` import gives raw SVG markup, not a component), a bar
  per quota metric with its reset countdown, a Models list, a Today-by-
  project grid, and a total. Colors are a deliberate departure from
  `token-monitor`'s own CSS — matched to the user's reference screenshot
  instead (`#d97757` Claude, `#3b82f6` Codex).
- **`TokenView.jsx`** renders a Claude + Codex `UsageCard` pair, independent
  of the project-scoped historical section below it — quota/today's-usage
  is whole-machine data, not scoped to whichever ACE project is active.
- **Shared poll (TICKET-0023)**: `liveUsage`/`liveUsageLoading`/
  `loadLiveUsage` live in `useStore.js`, not local component state. `App.jsx`
  starts the one 60s poll (`LIVE_USAGE_POLL_MS`) on mount, so both
  `TokenView.jsx` and the Agents tab's `UsageBar.jsx` read the same data
  instead of each spawning its own `tokscale` subprocess call on its own
  timer — `TokenView.jsx`'s "Refresh" button just calls the shared action.
- **`UsageBar.jsx`** (TICKET-0023): a compact second presentation of the
  same `liveUsage` slice above the Agents tab's toolbar — one slim row per
  provider (icon, mini bar, "`X`% used", "`Y`% available", reset countdown)
  for the *primary* quota metric only (`quota[0]` — Claude's 5-hour rolling
  window, Codex's only metric, Weekly), reusing `formatReset`/
  `METRIC_LABELS` exported from `UsageCard.jsx` rather than duplicating
  them. Renders even with no project selected, since quota is whole-machine
  data.

### Terminal (TICKET-0019)
Ported from Flowgrid's terminal implementation. Real interactive shells —
one per running agent, each running the actual `claude`/`codex` CLI
interactively — replacing what AgentPane used to render as a headless
`--print`/stream-json chat thread:
- **`ptyHost.js`**: a forked child process (never the Electron main process
  itself) hosting `node-pty` sessions, keyed by session id so it can host
  many concurrent sessions (one per agent card, plus any others). Kept in
  its own process, same reason as Flowgrid: node-pty is a native module
  that would otherwise need an `electron-rebuild` step to load into
  Electron's own Node ABI, and a crash in an unrelated part of the app must
  never take down a live shell (or whatever CLI, e.g. `claude`, is running
  inside it) — and vice versa. Forked with plain `node` in dev /
  `ELECTRON_RUN_AS_NODE=1` once packaged, matching the pattern
  AgentService's own child-process spawning already established.
- **`TerminalService`**: forks/supervises `ptyHost.js`, auto-restarts it on
  crash, forwards `terminal:data`/`terminal:exit`/`terminal:hostRestarted`
  to the renderer. Same `init(mainWindow)`/`setWindow()` shape as
  AgentService so `index.js` wires both the same way. `_forkHost()` passes
  `windowsHide: true` to its `fork()` call (TICKET-0027) — without it,
  Windows shows a console window for this forked `node.exe` process, since
  `child_process.fork()` defaults to a visible window when a
  console-subsystem executable is spawned from a windowed (GUI-subsystem)
  parent like Electron's main process. Otherwise unchanged since first
  built — already generically multi-session, so giving every agent its own
  terminal needed no other backend changes.
- **`AgentTerminal.jsx`** (renderer, one instance per running agent card):
  xterm.js + FitAddon, spawned via `window.cpi.terminal.spawn({cwd: agent.
  projectPath})` when the card mounts, then immediately writes the agent's
  launch command (built by `utils/agentLaunch.js` from its
  provider/model/permissionMode — the same CLI flags `AgentService.
  buildPermissionArgs` uses for the headless path, since they apply
  identically to an interactive invocation) as the session's first
  keystrokes, so the card boots straight into the real CLI instead of an
  empty shell. Mounted only while `agent.status === 'running'`; unmounting
  (Stop or Delete) disposes its PTY session in cleanup, which actually ends
  the CLI process — not merely hides it. It survives switching *tabs* away
  and back — see the `AgentView` point below (TICKET-0027) — and, as of
  TICKET-0030, also survives switching *projects* away and back: `AgentView`
  now keeps every agent's card mounted for every project visited this
  session, hiding non-active ones with CSS instead of unmounting them, the
  same pattern TICKET-0027 already used one level up for tabs. Only Stop,
  Delete, or the app quitting actually end a session now — re-selecting a
  previously-visited project reconnects to the still-running terminal
  (scrollback intact) instead of starting a brand-new one. A project not yet
  visited this session (or a fresh app launch) still restores its running
  agents with brand-new sessions, same as before — there's no live PTY
  process to reconnect to until this app has actually launched one.
- **AgentView's restore effect guards against re-adding an already-present
  agent (TICKET-0024).** Before TICKET-0027 (below), `App.jsx` rendered
  `AgentView` conditionally (`activeView === 'agents'`), so leaving and
  returning to the Agents tab unmounted/remounted it and reran its restore
  `useEffect` — but the `agents` array lives in the Zustand store, not
  component state, and (as of TICKET-0030) is never cleared at all, only
  ever appended to. Without a guard, every return trip to the tab
  re-fetched and re-added every persisted row, producing duplicate cards
  and, for a running agent, a second `AgentTerminal` mount that spawned a
  second real PTY/CLI process for the same agent. The effect now skips any
  row whose `agentId` is already in the store. Still relevant even after
  TICKET-0027 stopped `AgentView` from unmounting on tab switches — this
  guard is what makes the restore effect's rerun on every `activeProject`
  change (switching to a project already visited this session) not re-add
  already-running agents either — see the `AgentView` hide-not-unmount
  point below (TICKET-0030).
- **`AgentView` stays mounted across tab switches (TICKET-0027).**
  `App.jsx` used to render it conditionally (`{activeView === 'agents' &&
  <AgentView />}`); it's now always rendered, hidden with a CSS class when
  another tab is active, the same hide-not-unmount pattern the original
  standalone `TerminalPanel.jsx` used. Conditional mounting meant every
  tab switch away and back tore down and rebuilt every `AgentTerminal`
  for every running agent — killing and re-spawning its real CLI process
  each time, each spawn a fresh chance for a console-window flash and lost
  scrollback, and with several agents running this could visibly read as
  multiple windows opening at once. Only `AuditView`/`TokenView`/
  `SettingsView`/`EditorView` are still conditionally mounted — none of
  them own a long-lived OS process, so there's nothing to preserve across
  their remounts. A project switch used to still tear sessions down
  regardless of `AgentView`'s own mount state, since that was driven by the
  `agents` store array being reset on `setActiveProject` — TICKET-0030
  below removed that reset too, so a project switch no longer disposes any
  session either.
- **`AgentView` renders every agent across every visited project, hiding
  non-active ones with CSS instead of unmounting them (TICKET-0030).**
  Before this, `setActiveProject` reset the `agents` store array on every
  project switch, unmounting every `AgentPane`/`AgentTerminal` for the old
  project and disposing their PTY sessions — a real regression relative to
  the original standalone-panel design, and a known limitation ever since
  TICKET-0019. `setActiveProject` no longer touches `agents` at all;
  `AgentView` now maps over the *entire* store array and wraps each card in
  a div toggled `hidden` based on `agent.projectId === activeProject.id`,
  the same hide-not-unmount pattern TICKET-0027 already used one level up
  for tab switches. The empty-state message and the new-agent default-label
  uniqueness check are scoped to just the active project's agents
  (`projectAgents`), since those should still reflect only what's visible.
  Trade-off: every running agent across every visited project now keeps a
  live PTY/xterm instance even while hidden, not just the active project's
  — accepted since session continuity was the explicit ask; revisit only if
  running many agents across many projects at once turns out to cost
  noticeably in practice.
- **The CLI's own startup splash is hidden on every genuine launch
  (TICKET-0025).** Every `AgentTerminal` mount is a fresh `claude`/`codex`
  session, and the real CLI prints its own account/session banner, "What's
  new", and tips on every fresh session start. Before TICKET-0027 this
  reprinted on every tab-switch remount too, not just a real new launch;
  now that sessions survive both tab switches and project switches
  (TICKET-0030), it only fires on an actual first launch or a Stop →
  relaunch. No CLI flag suppresses the
  splash itself (`--help` on both CLIs and the bundled `claude.exe`'s own
  known `CLAUDE_CODE_*` env vars checked, none apply), so it's still
  covered with a "Launching…" overlay for a fixed `LAUNCH_BANNER_HIDE_MS`
  (1200ms) after the launch command is sent, then wiped with a local
  `term.clear()` (xterm.js's own buffer, display-only — never touches the
  real process) before revealing the now-clean live session. Deliberately
  timing-based rather than matched against specific CLI output text (which
  differs between Claude/Codex and across CLI versions) — degrades
  gracefully (a brief flash) instead of hanging if a future CLI's output
  stops matching an expected marker. Reveals immediately without clearing
  if the session errors or exits before the timer fires, so that message
  stays visible.
- Session lifetime otherwise: ends when the user disposes it (Stop/unmount)
  or the app quits (`TerminalService.shutdown()` in `window-all-closed`,
  mirroring `AgentService.killAll()`). Verified directly (bypassing the
  UI): forking `ptyHost.js` standalone, spawning a session, and sending the
  same `{channel: 'shutdown'}` message `TerminalService.shutdown()` sends
  confirms the real OS shell process is dead afterward
  (`process.kill(pid, 0)` throws `ESRCH`) — not just that the IPC call
  resolved.
- **Not gated behind a setting.** The first pass built this as a single
  opt-in standalone floating shell (`TerminalPanel.jsx`, `terminal_enabled`
  setting) — corrected once the user clarified they actually wanted a
  terminal embedded per agent, which is now simply how launching an agent
  works, not a separate opt-in feature. `TerminalPanel.jsx` and the
  `terminal_enabled` setting/toggle were removed outright rather than kept
  alongside the per-agent version.
- **Audit trail / token tracking implication:** since agents no longer run
  through `AgentService.sendPrompt`'s stream-json parsing, new agents don't
  generate `prompts` table rows — Audit Log and Token Usage only show
  historical data from before this change. See Token Tracking below and
  TICKET-0019 Notes for the reasoning and a possible future fix (reconcile
  against tokscale's session transcripts directly, without the headless
  path).
- **Windows backend**: node-pty defaults to ConPTY (not the legacy winpty
  bridge) whenever the Windows build is ≥ 18309 (Windows 10 1903+/Windows
  11) and `ptyHost.js` doesn't override `useConpty` — confirmed via
  node-pty's own `WindowsPtyAgent` default logic, not just assumed.
- **Auto-answer permission prompts (TICKET-0038/0039), a purely per-agent
  live toggle** — the 🛡️ Auto-approve pill on each running agent's terminal
  card (`AgentTerminal.jsx`), flipped via `window.cpi.terminal.setAutoAnswer
  (id, enabled)` → `TerminalService.setAutoAnswer` → `ptyHost.js`'s
  `setAutoAnswer`. No spawn-time parameter, no global Settings toggle
  (removed in TICKET-0039's follow-up) — every session starts off, and
  turning the pill on acts immediately, including on a prompt already on
  screen (it checks the session's already-accumulated buffer, not just
  future chunks). When on, `ptyHost.js` watches the session's raw PTY
  output for a real Claude/Codex CLI permission prompt and auto-confirms
  it, for models/setups that don't support `--dangerously-skip-permissions`.
  The real prompt is an **Ink-rendered TUI menu**, not plain text — e.g.
  `Do you want to allow Claude to fetch this content? ❯ 1. Yes` — and
  critically its words aren't separated by literal spaces in the raw byte
  stream: Ink uses a cursor-forward escape code (`\x1b[1C`) per word gap
  and cursor-absolute-position codes (`\x1b[<row>;<col>H`) between
  redrawn lines, so a plain-text regex against raw chunks can never match
  it regardless of wording (confirmed by spawning a real `claude` session
  through node-pty directly, bypassing ACE, and dumping raw output — see
  TICKET-0038's Notes if this needs revisiting, that technique is the
  reusable way to debug any future PTY-output-matching issue here rather
  than guessing prompt formats from memory, which is exactly how this
  shipped broken twice the same day). `ptyHost.js`'s `stripAnsi()`
  reconstructs approximate visible text from a rolling 4000-char raw
  buffer (cursor-forward → space, cursor-position → newline, other
  CSI/OSC dropped), then matches `/[❯>]\s*1\.\s*\S/` — the
  selection-arrow-plus-default-option marker common to every one of these
  Ink prompts (workspace-trust dialog included), matching either glyph
  Ink might render it as (see below) and any first-option wording, not
  just "Yes" — and responds with a plain `\r` (Enter, confirming the
  pre-selected option; there's no `(y/n)` text field, so a literal `y`
  keystroke would do nothing), verified-and-retried up to twice (~600ms
  apart) in case the keystroke didn't land. 200ms debounce and a buffer
  clear after each match prevent double-answering.

  **Three real bugs found across two tickets before this actually worked
  live**, worth remembering as a pattern: (1) TICKET-0038 originally
  guessed a plain-text `(y/n)` format the CLI never prints. (2) TICKET-0039
  found the pattern was hardcoded to the literal word "Yes" — a real
  browser-tool permission prompt read `❯ 1. Allow` instead; fixed by
  matching the selection-arrow marker structurally, any wording. (3) Still
  failed live for the *original* "Yes" case with the fix in place — the
  real Electron-forked `ptyHost` process's spawn environment renders Ink's
  selection arrow as a plain ASCII `>`, not the fancy Unicode `❯`, while a
  standalone test harness spawning the same CLI differently got the fancy
  glyph (other Unicode in the same buffer rendered fine, so not a blanket
  encoding issue — specifically that one Ink indicator's fallback choice).
  Found by adding temporary file-based debug logging to `ptyHost.js` and
  reading it directly after asking the user to reproduce once in their own
  already-open app — live-spawning a fresh unattended test agent, and
  separately a PowerShell-based attempt to drive the user's open app via
  simulated OS input, were both blocked by Claude Code's own auto-mode
  safety classifier and correctly not routed around (see TICKET-0039).
  Live-verified end-to-end by the user directly with the fix in place: a
  single initial prompt drove a real WebFetch, Web Search, second Fetch,
  and local save to completion with zero manual clicks.

### Screenshots (TICKET-0034, reworked from TICKET-0032)
Interactive drag-to-select screen capture, saved into the active project's
own folder so the real `claude`/`codex` CLI running in its terminal can
read it straight from disk by a relative path:
- **`ScreenshotService.captureRegion(projectRoot)`** (main process): grabs
  the primary display via `desktopCapturer` at its full pixel resolution
  (`display.bounds` × `display.scaleFactor`), hands the frame to a
  selection overlay (`_runOverlay`), crops the user's drag-selected rect
  into that frame's own pixel space, and saves it as a timestamped PNG
  under `<projectRoot>/.cpi/screenshots/`. `ensureGitignored` appends
  `.cpi/` to the project's `.gitignore` (creating the file if missing,
  idempotent) so this data never gets committed to the user's own repo.
  The saved file's path *relative to the project root* (not absolute,
  since that's the same root the agent's terminal already runs from as its
  cwd) is written to the OS clipboard. Resolves `{ ok:false,
  reason:'cancelled' }` rather than throwing if the user backs out
  (Esc/right-click/a too-small selection) — not an error case.
- **Deliberately does not hide ACE's own window before capturing.** An
  earlier version did; removed after live feedback ("when i click the
  screenshot button the app hides, that cant happen because sometimes i
  need to screenshot the app") — the feature's whole point includes
  visual UI debugging/feedback on ACE itself, which auto-hiding made
  impossible. Matches how standard capture tools (Snipping Tool,
  Greenshot) behave: they don't hide their own invoking window either. If
  the user wants to exclude ACE, they can move/minimize it first, same as
  with those tools.
- **Selection overlay** (`_runOverlay`, `src/main/overlay/`): a frameless,
  transparent, always-on-top `BrowserWindow` sized to exactly the primary
  display, painted with the already-captured frame as a data URL, letting
  the user drag a selection rectangle over it (Esc or right-click
  cancels). Kept as its own `BrowserWindow` (not part of the main window)
  so it can sit above literally everything on screen — same isolation
  reasoning as `ptyHost.js` living in its own process, just for window
  layering instead of process crashes. Its own preload
  (`screenshot-overlay-preload.js`) is scoped to that window's
  `webContents.ipc`, not global `ipcMain`, so a second capture started
  before the first settles can never cross-wire.
- **`screenshots:captureRegion`** IPC handler / `window.cpi.
  screenshots.captureRegion(projectPath)` (preload) wire it to a 📸 button
  on each running agent's card (`AgentView.jsx`), which shows a status
  message (saved / cancelled / error) for 4s and disables the button
  (swapping the icon for `…`) while a capture is in progress.
- **Known UX trap, carried forward from TICKET-0032's clipboard-paste
  version and still relevant here:** the status message itself must stay
  non-selectable (`select-none`). Worded around "path copied," it's a
  natural (and destructive) target for the user to select/copy instead of
  pressing Ctrl+V — silently overwriting the real path the capture just
  placed on the clipboard.
- **Supersedes TICKET-0032's clipboard-paste model** (read whatever image
  was already on the OS clipboard, saved per-agent under Electron's
  `userData` dir). Rationale for the rework: clipboard-paste required a
  separate screenshot tool already running, and left files disconnected
  from the project; direct in-app region capture is one step instead of
  two, and project-scoped files make sense given prompts run with the
  project as cwd. TICKET-0032 stays closed as shipped-then-superseded
  rather than reopened.

### Auto-Title (TICKET-0070)
Renames an agent's card label from a random default name to a short,
content-derived title, so several running cards are distinguishable at a
glance — helps session management the same way ChatGPT/Claude.ai auto-titling
a conversation does, without an extra AI call:
- **`renderer/utils/firstLineCapture.mjs`** (pure, no DOM/Electron deps) —
  the one renderer util that's `.mjs` rather than `.js`: it needs to load
  unambiguously as ESM both through Vite (renderer bundle) and via Node's
  built-in test runner's dynamic `import()` (`tests/first-line-capture.test.js`),
  and `package.json` has no `"type": "module"` for a plain `.js` file using
  `export` to work either way without a bundler in between.
  - `feedLineCapture(buffer, data)`: a small parallel line-buffer fed every
    chunk `AgentTerminal.jsx`'s existing `term.onData` handler already
    receives (the same chunks forwarded to the PTY) — handles backspace,
    strips ANSI/VT escape sequences (arrow keys etc.) instead of appending
    them, and finalizes on `\r`/`\n`, skipping empty submissions (e.g. an
    accidental Enter) so it keeps waiting for the first real line.
  - `deriveTitle(rawLine)`: trims/collapses whitespace and truncates to 60
    chars at a word boundary with an ellipsis.
  - **Known, accepted limitation**: this is a parallel reconstruction, not a
    real terminal-line emulator — in-line edits made with arrow keys/Home/End
    inside the CLI's own readline-style input aren't replayed faithfully.
    Fine for a best-effort auto-title; not worth a real emulator for this.
- **`AgentTerminal.jsx`** feeds every `term.onData` chunk through
  `feedLineCapture` alongside its existing forward-to-PTY call, guarded by
  `titleCapturedRef` (initialized from `agent.titleSet`, see below) so this
  only ever fires once per mounted session. On the first finalized non-empty
  line, calls `deriveTitle` and updates the label both in the Zustand store
  (`useStore.getState().updateAgentLabel`, immediate UI update) and via
  `window.cpi.updateAgentLabel` → `agents:updateLabel` IPC →
  `DBService.updateAgentLabel` (persists `label` and sets the new
  `agents.title_set` column so the title survives a restart/restore).
- **Why `label` itself, not a second field**: `label` is already the one
  thing rendered everywhere an agent needs identifying (card header, delete
  confirm, launch-bar default-uniqueness check, the `agent_sessions`
  snapshot backing the Token Usage "By Agent" breakdown) — a parallel
  `title` field would either duplicate all of those reads or leave most of
  them still showing the stale random name.
- **`agents.title_set` (new column, migrated in `DBService._migrateSchema()`)**
  exists specifically so a *restored* agent (project switch back, or app
  restart — always a brand-new `AgentTerminal` mount per the Terminal
  section above, since there's no live PTY to reconnect to) doesn't treat
  the next line the user types as a fresh "initial request" and clobber an
  already-good title with a mid-conversation follow-up. `AgentView.jsx`'s
  restore effect reads it off the DB row (`!!row.title_set`) and passes it
  through as `agent.titleSet` regardless of which restore branch (running
  vs. stopped) built the rest of `meta`. A brand-new agent (never
  persisted) simply has `agent.titleSet` undefined → falsy → capture arms
  normally.

### File Explorer / Editor (TICKET-0021)
A VS Code-style file tree in the Sidebar plus a Monaco editor, so the user
can browse and edit a project's files directly rather than only through an
agent:
- **`FileService`** (main process, stateless — no window/lifecycle wiring
  needed, unlike AgentService/TerminalService): `readDir`/`readFile`/
  `writeFile`, each taking the requesting project's root path and
  refusing any resolved path that falls outside it
  (`resolveWithinRoot`) — defense in depth, not a new trust boundary (see
  Notes below). `readFile` refuses files over 2MB or that look binary
  (null-byte heuristic) rather than trying to load them into the editor.
- **`FileTree.jsx`**: one node per directory entry; a directory's children
  are fetched via `fs:readDir` only on first expand, not walked eagerly
  for the whole project (would choke on a real `node_modules` tree).
  Clicking a file calls `fs:readFile` and, on success, opens it in
  `EditorView` (switches `activeView` to `'editor'`).
- **Right-click menu (TICKET-0033, file rows only, not directories)**: a
  generic `ContextMenu.jsx` (position-at-cursor, closes on outside
  click/Escape) offers **Open** (same as left-click), **Open in Explorer**
  (`shell.showItemInFolder` via `fs:openInExplorer`), and — only for
  files matching an executable-like extension allowlist
  (`.exe/.bat/.cmd/.ps1/.vbs/.com/.msi`, checked both in `FileTree.jsx` for
  menu gating and again in `FileService.runFile` as the real authority) —
  **Run**, which spawns the file the way double-clicking it in Explorer
  would (`fs:runFile`), routed through the same `resolveWithinRoot`
  containment check as every other `FileService` method. Deliberately not
  `windowsHide`'d, unlike this app's own background spawns (TICKET-0029)
  — a user-invoked Run should show a console window like a real
  double-click. `.ps1` is special-cased to spawn `powershell.exe -File`
  directly, since Explorer's own default double-click verb for PowerShell
  scripts is Edit, not Run (a deliberate Windows security default) — the
  file-association path every other allowlisted extension uses wouldn't
  actually execute it.
- **`EditorView.jsx`**: tab strip of open files + a Monaco instance (`@monaco-editor/react`) for the active one, dirty-state dot per tab, Ctrl+S/Save
  button that calls `fs:writeFile`. Tabs share one mounted `<Editor>`
  instance switching its `path`/`value` props rather than remounting per
  tab, so Monaco's own per-file undo history is preserved across tab
  switches.
- **Store**: `openFiles` (`{path, name, content, originalContent, dirty}[]`)
  + `activeFilePath` in `useStore.js`. Switching projects clears both
  (files are scoped to whichever project's tree they were opened from,
  same reasoning as clearing `agents` on project switch) — `Sidebar.jsx`
  confirms first if any open file is dirty.
- **Monaco bundling**: `monaco-editor` is loaded from the local npm
  package (via `loader.config({ monaco })` in `EditorView.jsx`), not
  fetched from a CDN — `vite-plugin-monaco-editor-esm` bundles its web
  workers as local build assets (`vite.renderer.config.mjs`). Two
  version/config issues had to be worked around to get this building at
  all — see TICKET-0021 Notes if touching this again: `monaco-editor` is
  pinned to `0.50.0` (newer versions changed their package.json `exports`
  map in a way the plugin's hardcoded worker subpaths don't handle), and
  `build.outDir` in `vite.renderer.config.mjs` is relative rather than
  absolute (the plugin's own output-path calculation assumes a
  root-relative `outDir`).

### Services (main process)
- **AgentService**: spawns/kills CLI processes, streams output via IPC
- **DBService**: all SQLite reads/writes
- **AgentService stream parsers**: parse responses, sessions, tools, denials, and token counts from CLI JSON output
- **TokscaleService**: spawns the `tokscale` npm package to read Claude Code's/Codex's own local session transcript files and return authoritative per-session token + cost totals (see Token Tracking below), plus real subscription quota and today's model/project breakdowns (see Live Token Usage Dashboard below)
- **TerminalService**: forks/supervises `ptyHost.js`, forwards its data/exit events to the renderer — see Terminal above
- **FileService**: reads/writes project files for the Sidebar file tree + Monaco editor, containment-checked against the requesting project's root — see File Explorer / Editor above
- **ScreenshotService**: drag-to-select screen capture saved into the active project's own folder — see Screenshots above
- **LoadBalancer**: decides provider based on credit status

---

## Folder Responsibilities
```
src/
  dist/           — complete production application generated by the build
  main/           — Electron main process
    services/     — AgentService, DBService, LoadBalancer, TokenParser, TerminalService, FileService, ScreenshotService (TICKET-0034)
    ipc/          — IPC handler registrations
    ptyHost.js    — forked node-pty host process (TICKET-0019)
    overlay/      — screenshot-overlay.html/.js/-preload.js, the drag-to-select capture window (TICKET-0034)
  renderer/       — React app
    components/   — Reusable UI components (incl. AgentTerminal.jsx TICKET-0019, FileTree.jsx TICKET-0021, UsageCard.jsx TICKET-0022, UsageBar.jsx TICKET-0023)
    views/        — AgentView, AuditView, TokenView, SettingsView, EditorView (TICKET-0021)
    utils/        — agentNames.js, agentLaunch.js (TICKET-0019 interactive launch-command builder)
    assets/icons/ — claude.svg, codex.svg (TICKET-0022, copied from the token-monitor reference app)
    store/        — Zustand state
  scripts/        — build helpers
  tests/          — Node test runner suites
```

---

## Dependencies
| Package | Reason |
|---|---|
| electron | Desktop app shell |
| vite + @vitejs/plugin-react | Renderer bundling |
| react 18 + react-dom | UI framework |
| tailwindcss | Utility-first styling |
| sql.js | WASM SQLite (main process) — no native build step; DBService persists to disk manually via `db.export()` after every write, since sql.js keeps the DB in memory |
| tokscale | Reads Claude Code's/Codex's own local session transcript files for authoritative token + cost usage — see Token Tracking above. Ships a Node shim (`bin.js`) that resolves the right native platform binary as an optional dependency and runs it via its own nested, un-hidden `spawnSync` — on Windows, `TokscaleService` skips that shim and spawns the platform binary package (`@tokscale/cli-win32-{x64,arm64}-msvc`) directly with `windowsHide: true` instead, since the shim's inner spawn otherwise flashes a console window every poll (TICKET-0029); other platforms still go through the shim via `ELECTRON_RUN_AS_NODE=1` since Electron's own binary isn't plain Node. Packaged with `asarUnpack` (native binary can't run from inside an .asar) |
| node-pty | Real PTY sessions for the Terminal panel (TICKET-0019). Native module — never loaded into the Electron main process directly, only into forked `ptyHost.js` (plain `node` in dev / `ELECTRON_RUN_AS_NODE=1` packaged), so no `electron-rebuild` step is needed. Its install script is native-build/prebuilt-binary-fetch, so it's listed in `package.json`'s `allowScripts` (npm 11's script-allowlisting). Packaged with `asarUnpack`, same reason as tokscale |
| @xterm/xterm, @xterm/addon-fit | Terminal panel's UI — renders the PTY session, resizes to fit its container (TICKET-0019) |
| @monaco-editor/react, monaco-editor (pinned 0.50.0), vite-plugin-monaco-editor-esm | Code editor for the file explorer (TICKET-0021) — the same editor VS Code itself uses. monaco-editor pinned below latest, and the Vite plugin bundles its workers as local assets rather than a CDN fetch — see File Explorer / Editor above for why |
| recharts | Token usage charts |
| zustand | Renderer state management |
| electron-builder | Package to .exe |

---

## Cross-Platform (TICKET-0037)
Builds and runs on both Windows and macOS. Most of the codebase is
inherently cross-platform (Electron, React, sql.js WASM, Vite). The
platform-specific code paths are:
- **`ptyHost.js`** — `defaultShell()`: `powershell.exe` on win32,
  `$SHELL` or `/bin/bash` elsewhere
- **`AgentService.js`** — `shell: process.platform === 'win32'` for
  `.cmd` shim spawning
- **`TokscaleService.js`** — win32 resolves the native binary directly
  (TICKET-0029); elsewhere goes through the JS shim via
  `ELECTRON_RUN_AS_NODE=1`
- **`FileService.js`** — `RUNNABLE_EXTENSIONS` and `runFile()` use
  platform-specific extension sets and spawn logic
- **`FileTree.jsx`** — reads `window.cpi.platform` (exposed via
  `preload.js`) to show the right runnable extensions in the context menu
- **`TerminalService.js`** — `windowsHide: true` is harmless on
  non-Windows (ignored)
- **`ScreenshotService.js`** — uses cross-platform Electron APIs
  (`desktopCapturer`, `screen`)
- **`index.js`** — standard macOS `process.platform !== 'darwin'` quit
  pattern already present
- **`package.json`** — `build.mac` targets dmg for x64 + arm64 with
  hardened runtime entitlements; `build.win` targets portable + NSIS
  for x64

---

## Design Principles
- Main process owns all I/O (DB, file system, child processes)
- Renderer is pure UI — sends IPC requests, renders results
- Every AI interaction is logged before and after (audit-first)
- Claude and Codex implement the same provider interface
- Single-instance (TICKET-0043): `index.js` acquires
  `app.requestSingleInstanceLock()`; a second launch quits and focuses the
  existing window via the `second-instance` handler, so exactly one process
  ever owns the on-disk `cpi.db` and one window ever owns OS keyboard focus

---

## Gotchas
- **sql.js `db.export()` resets `last_insert_rowid()` to 0.** DBService's
  `prepare(sql).run()` calls `save()` (which calls `export()`) after every
  write. Any code that needs the id of a just-inserted row must read
  `last_insert_rowid()` *inside* `run()`, before `save()` runs — not in a
  separate query afterwards, which will always get `0`. This caused
  TICKET-0013 (agent responses never persisted) and was very likely the
  dominant cause of TICKET-0012 (token stats never persisted) too.
- **One prompt per agent at a time.** Each accepted prompt receives a unique
  execution ID used to match process completion to its audit record.
- **Production layout.** Electron Builder runs from `src`; both renderer and
  main-process output therefore live under `src/dist`.
- **`npm run dev` does NOT rebuild the main process.** `package.json`'s
  `"main"` field points at `dist/main/index.js`, and `dev:main` (`wait-on
  ... && electron .`) just launches whatever is already there — it never
  runs `build:main`. Only `dev:renderer` (Vite) is live. Any edit under
  `src/main/**` needs an explicit `npm run build:main` before the next
  `npm run dev` picks it up, or Electron silently runs the old code with no
  error (discovered while building TICKET-0019: the terminal wired up fine
  in source but never spawned anything until `dist/main` was rebuilt).
- **`npm run dev` reuses whatever's already on port 5173, silently.**
  `dev:main` hard-waits on `http://localhost:5173` specifically; if a prior
  `npm run dev` is still running (stray process, or a window left open from
  earlier in the same session), Vite's new instance just moves to 5174 and
  Electron's `wait-on` happily connects to the *old* server on 5173 instead
  — meaning a second `npm run dev` doesn't preview any new source changes,
  it just opens a redundant second window onto the old process, and (worse)
  a second full app instance pointed at the same on-disk SQLite database
  (`db.export()`-on-every-write, see above) that a badly-timed write from
  either instance could corrupt. Before starting a dev instance to verify a
  change, check `netstat -ano | grep 5173` (or just try the window that's
  already open — Vite HMR keeps it current) rather than assuming a fresh
  `npm run dev` gives a clean instance (discovered verifying TICKET-0023).
  **A second, genuinely isolated instance is still possible** without
  touching the first: `electron.exe . --user-data-dir=<separate path>`
  gives it its own `cpi.db` (Electron's userData path, which is what
  `DBService`'s `path.join(app.getPath('userData'), 'cpi.db')` resolves
  from, is normally derived from the app name — `--user-data-dir` is a
  native Electron/Chromium switch that overrides it directly). Since
  TICKET-0043 `index.js` holds an `app.requestSingleInstanceLock()`, so a
  second launch **on the same userData profile** quits immediately and just
  focuses the running window instead of starting a competing process. The
  lock is keyed to the userData path, so a second instance launched with its
  own `--user-data-dir` (the isolation trick above) gets its own lock
  namespace and still runs fine — which is exactly why verifying the lock
  itself requires launching two instances that *share* one throwaway
  `--user-data-dir` so they actually contend for it. Reusing the
  already-running Vite server on 5173 for that second instance's renderer is
  fine (read-only, same unchanged renderer code) as long as only
  `src/main/**` changed.
- **A shell with `ELECTRON_RUN_AS_NODE=1` set breaks launching
  `electron.exe` as a real Electron app** — a session already running
  inside Claude Code (or any tool that forks Node via
  `ELECTRON_RUN_AS_NODE`, same trick `TerminalService._forkHost()` uses
  intentionally for `ptyHost.js`) inherits that env var, and running
  `electron.exe` directly in that shell makes Chromium/Electron init never
  happen — `electron.exe` just runs `index.js` under plain Node instead,
  so `require('electron')` resolves to a path string, not the API, and
  `app.whenReady()` throws `Cannot read properties of undefined`. Fix:
  unset it for the launch (`env -u ELECTRON_RUN_AS_NODE ... electron.exe`
  in a POSIX shell) — discovered launching a second isolated instance to
  live-verify TICKET-0038.
- **Driving this app's UI programmatically** (for a live end-to-end test,
  same need as TICKET-0022/0024's "verified via Chrome DevTools Protocol
  automation" notes) has no existing harness/script in this repo — there's
  no puppeteer/playwright dependency. Built ad hoc for TICKET-0038 with
  nothing but Node's built-in `WebSocket`/`fetch` (Node 22+, no install
  needed): launch with `--remote-debugging-port=<port>`, `GET
  http://127.0.0.1:<port>/json` to find the target whose `url` is
  `http://localhost:5173/` (there's also a `"DevTools"` target — skip it),
  open a WebSocket to its `webSocketDebuggerUrl`, and speak raw CDP
  (`Runtime.evaluate` for React-level clicks/reads — plain
  `element.click()` works fine since React's delegated listeners still
  fire on a real DOM `click` event — `Input.dispatchMouseEvent` /
  `Input.insertText` / `Input.dispatchKeyEvent` for typing into the
  xterm.js terminal specifically, since that's a real `<textarea>` xterm
  owns, not a React-controlled input, and `Page.captureScreenshot` for
  visual confirmation at each step). `Input.enable` is not a real CDP
  method — don't call it, the domain needs no enable step.

## Future Improvements
- WebSocket-based agent output stream
- Plugin system for additional AI providers
- Prompt replay for reproducibility
