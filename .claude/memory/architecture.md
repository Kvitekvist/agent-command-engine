# Project Architecture

## Overview
Claude Projects Interface (CPI) is an Electron desktop application with a React renderer. The main process manages child processes (AI CLI tools), the SQLite database, and file system access. The renderer provides the React UI. IPC channels bridge the two.

---

## Components

### User Interface (Renderer — React + Tailwind)
- **Sidebar**: project list, switcher, active project indicator, and a
  file tree scoped to the active project (TICKET-0021) — see File
  Explorer / Editor below
- **Agent Pane**: one card per launched agent, each embedding a real
  interactive terminal (TICKET-0019) — see Terminal below
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
- **Codex is not reconciled.** CPI spawns `codex exec` stateless (no
  `resume`), so there is no stable per-turn session id to match a tokscale
  row against — matching by "most recently written codex session file"
  would misattribute tokens whenever two Codex agents finish close together,
  which this app's multi-agent design allows. Codex token counts stay at
  the (inaccurate) stdout-parsed value, effectively always `0` today, until
  a future ticket gives codex real session resumption. (Also: this whole
  headless path is unused by the UI as of TICKET-0019 anyway — see above.)
- `TokenView.jsx`'s historical section prefers the reconciled `cost_usd`
  from the DB when present and only falls back to the static `COST_PER_M`
  estimate table for rows that were never reconciled (Codex, or a Claude
  turn rendered before its correction lands).

### Live Token Usage Dashboard (TICKET-0022)
The Token Usage tab's primary content (and the app's default tab) — real
subscription usage, sourced live from the `tokscale` binary rather than
CPI's own `prompts` table, so it stays accurate regardless of whether an
agent ran through the old headless path or the new embedded terminal:
- **`TokscaleService.getQuota()`**: runs `tokscale usage --json`, tokscale's
  own subcommand for real subscription quota — reads the same local OAuth
  credentials Claude Code/Codex already use, so CPI never touches auth
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
- **`TokenView.jsx`** renders a Claude + Codex `UsageCard` pair on a 60s
  poll (`LIVE_USAGE_POLL_MS`), independent of the project-scoped historical
  section below it — quota/today's-usage is whole-machine data, not scoped
  to whichever CPI project is active.

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
  AgentService so `index.js` wires both the same way. Unchanged since first
  built — already generically multi-session, so giving every agent its own
  terminal needed no backend changes at all.
- **`AgentTerminal.jsx`** (renderer, one instance per running agent card):
  xterm.js + FitAddon, spawned via `window.cpi.terminal.spawn({cwd: agent.
  projectPath})` when the card mounts, then immediately writes the agent's
  launch command (built by `utils/agentLaunch.js` from its
  provider/model/permissionMode — the same CLI flags `AgentService.
  buildPermissionArgs` uses for the headless path, since they apply
  identically to an interactive invocation) as the session's first
  keystrokes, so the card boots straight into the real CLI instead of an
  empty shell. Mounted only while `agent.status === 'running'`; unmounting
  (Stop, delete, or switching away from the project) disposes its PTY
  session in cleanup, which actually ends the CLI process — not merely
  hides it. Consequently an agent's interactive session does **not**
  survive switching projects away and back (a real limitation vs. the
  original standalone-panel design below; re-selecting the project starts
  a brand-new session) — see TICKET-0019 Notes.
- **AgentView's restore effect guards against re-adding an already-present
  agent (TICKET-0024).** `App.jsx` renders `AgentView` conditionally
  (`activeView === 'agents'`), so leaving and returning to the Agents tab
  unmounts/remounts it and reruns its restore `useEffect` — but the
  `agents` array lives in the Zustand store, not component state, and is
  only cleared on a real project switch (`setActiveProject`). Without a
  guard, every return trip to the tab re-fetched and re-added every
  persisted row, producing duplicate cards and, for a running agent, a
  second `AgentTerminal` mount that spawned a second real PTY/CLI process
  for the same agent. The effect now skips any row whose `agentId` is
  already in the store.
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
- **LoadBalancer**: decides provider based on credit status

---

## Folder Responsibilities
```
src/
  dist/           — complete production application generated by the build
  main/           — Electron main process
    services/     — AgentService, DBService, LoadBalancer, TokenParser, TerminalService, FileService
    ipc/          — IPC handler registrations
    ptyHost.js    — forked node-pty host process (TICKET-0019)
  renderer/       — React app
    components/   — Reusable UI components (incl. AgentTerminal.jsx TICKET-0019, FileTree.jsx TICKET-0021, UsageCard.jsx TICKET-0022)
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
| tokscale | Reads Claude Code's/Codex's own local session transcript files for authoritative token + cost usage — see Token Tracking above. Ships a Node shim (`bin.js`) that resolves the right native platform binary as an optional dependency; spawned via `ELECTRON_RUN_AS_NODE=1` since Electron's own binary isn't plain Node. Packaged with `asarUnpack` (native binary can't run from inside an .asar) |
| node-pty | Real PTY sessions for the Terminal panel (TICKET-0019). Native module — never loaded into the Electron main process directly, only into forked `ptyHost.js` (plain `node` in dev / `ELECTRON_RUN_AS_NODE=1` packaged), so no `electron-rebuild` step is needed. Its install script is native-build/prebuilt-binary-fetch, so it's listed in `package.json`'s `allowScripts` (npm 11's script-allowlisting). Packaged with `asarUnpack`, same reason as tokscale |
| @xterm/xterm, @xterm/addon-fit | Terminal panel's UI — renders the PTY session, resizes to fit its container (TICKET-0019) |
| @monaco-editor/react, monaco-editor (pinned 0.50.0), vite-plugin-monaco-editor-esm | Code editor for the file explorer (TICKET-0021) — the same editor VS Code itself uses. monaco-editor pinned below latest, and the Vite plugin bundles its workers as local assets rather than a CDN fetch — see File Explorer / Editor above for why |
| recharts | Token usage charts |
| zustand | Renderer state management |
| electron-builder | Package to .exe |

---

## Design Principles
- Main process owns all I/O (DB, file system, child processes)
- Renderer is pure UI — sends IPC requests, renders results
- Every AI interaction is logged before and after (audit-first)
- Claude and Codex implement the same provider interface

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

## Future Improvements
- WebSocket-based agent output stream
- Plugin system for additional AI providers
- Prompt replay for reproducibility
