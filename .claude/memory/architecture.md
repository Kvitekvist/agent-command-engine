# Project Architecture

## Overview
Claude Projects Interface (CPI) is an Electron desktop application with a React renderer. The main process manages child processes (AI CLI tools), the SQLite database, and file system access. The renderer provides the React UI. IPC channels bridge the two.

---

## Components

### User Interface (Renderer — React + Tailwind)
- **Sidebar**: project list, switcher, active project indicator
- **Agent Pane**: one card per launched agent, each embedding a real
  interactive terminal (TICKET-0019) — see Terminal below
- **Audit Log View**: searchable table of all prompts + responses (historical
  only as of TICKET-0019's correction — see Terminal)
- **Token Dashboard**: Recharts charts per prompt/task/project; cost estimates
  (historical only as of TICKET-0019's correction — see Terminal)
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
- **Codex is not reconciled.** CPI spawns `codex --print` stateless (no
  `--resume`), so there is no stable per-turn session id to match a tokscale
  row against — matching by "most recently written codex session file"
  would misattribute tokens whenever two Codex agents finish close together,
  which this app's multi-agent design allows. Codex token counts stay at
  the (inaccurate) stdout-parsed value, effectively always `0` today, until
  a future ticket gives codex real session resumption.
- `TokenView.jsx` prefers the reconciled `cost_usd` from the DB when present
  and only falls back to the static `COST_PER_M` estimate table for rows
  that were never reconciled (Codex, or a Claude turn rendered before its
  correction lands).

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

### Services (main process)
- **AgentService**: spawns/kills CLI processes, streams output via IPC
- **DBService**: all SQLite reads/writes
- **AgentService stream parsers**: parse responses, sessions, tools, denials, and token counts from CLI JSON output
- **TokscaleService**: spawns the `tokscale` npm package to read Claude Code's/Codex's own local session transcript files and return authoritative per-session token + cost totals — see Token Tracking below
- **TerminalService**: forks/supervises `ptyHost.js`, forwards its data/exit events to the renderer — see Terminal above
- **LoadBalancer**: decides provider based on credit status

---

## Folder Responsibilities
```
src/
  dist/           — complete production application generated by the build
  main/           — Electron main process
    services/     — AgentService, DBService, LoadBalancer, TokenParser, TerminalService
    ipc/          — IPC handler registrations
    ptyHost.js    — forked node-pty host process (TICKET-0019)
  renderer/       — React app
    components/   — Reusable UI components (incl. AgentTerminal.jsx, TICKET-0019)
    views/        — AgentView, AuditView, TokenView, SettingsView
    utils/        — agentNames.js, agentLaunch.js (TICKET-0019 interactive launch-command builder)
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
