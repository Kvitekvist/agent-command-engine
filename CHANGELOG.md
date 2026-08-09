# Changelog

## [Unreleased]

### Added
- Right-click context menu on files in the Sidebar's file tree: Open (same as clicking), Open in Explorer, and Run (for `.exe`/`.bat`/`.cmd`/`.ps1`/`.vbs`/`.com`/`.msi` files) — Run launches the file the same way double-clicking it in Explorer would, `.ps1` included even though Explorer's own default double-click behavior for PowerShell scripts is to open them in an editor rather than run them (TICKET-0033)
- 📸 button reworked from clipboard-paste to interactive drag-to-select screen capture: click it, drag a rectangle over any part of the screen (including ACE itself), and the region is saved into the active project's own `.cpi/screenshots/` folder (auto-added to the project's `.gitignore`) with its path copied to the clipboard, ready to paste into that agent's terminal. Fixed two bugs found during this rework's own live verification: the button referenced a leftover, never-defined handler from the prior clipboard-paste design, crashing the whole renderer the moment an agent card rendered; and the capture path hid ACE's own window first, which defeated the feature's own purpose of screenshotting ACE itself (TICKET-0034, supersedes TICKET-0032)
- Per-agent screenshot folders plus a 📸 button on each running agent's card: saves whatever image is on the clipboard into that agent's dedicated folder and copies the saved file's path back to the clipboard, ready to paste into that agent's terminal. Fixed a clipboard-clobber bug found during verification: the success message's own text was selectable and could silently overwrite the real path if clicked/copied instead of pasted (TICKET-0032)
- Agent terminal sessions now survive switching projects away and back, not just switching tabs — reconnects to the same running `claude`/`codex` session (scrollback intact) instead of restarting it from scratch, so you can jump between projects without losing an in-progress agent conversation (TICKET-0030)
- Agent cards briefly show a "Launching…" overlay while the real CLI's own startup splash (account info, "What's new", tips) renders, then reveal the already-clean live session instead of leaving that splash visible — it otherwise reprinted on every terminal (re)launch, including every tab switch away and back to an already-running agent (TICKET-0025)
- Compact usage bar above the Agents tab's toolbar: % used, % available, and reset countdown per provider (Claude, Codex), so quota is visible while launching/watching agents without switching to Token Usage. Shares one 60s poll with the Token Usage tab's dashboard instead of each spawning its own `tokscale` call (TICKET-0023)
- Live token usage dashboard, now the app's default tab: real Claude/Codex subscription quota (5-hour rolling + weekly limits, reset countdowns) plus today's usage by model and by project, sourced live from `tokscale`'s own account data — accurate regardless of whether an agent ran headlessly or through the new embedded terminal, unlike the existing DB-backed history (kept below it, relabeled) which only the old headless path ever populated. Design ported from the user's reference app `token-monitor` (TICKET-0022)
- File explorer: a VS Code-style file tree per project in the Sidebar, lazy-loading folders on expand. Click a file to open it in a real Monaco editor (tabs, per-file undo history, dirty-state indicator) and save straight to disk with Ctrl+S or the Save button (TICKET-0021)
- Every launched agent's card is now a real interactive terminal running the actual `claude`/`codex` CLI (ported from Flowgrid's `node-pty` architecture), not a headless chat-bubble thread — type directly into an agent's card to drive Claude Code's own interactive UI. Replaces the headless `AgentService.sendPrompt`/stream-json rendering, which is no longer called from the UI: Audit Log and Token Usage keep showing historical data but stop gaining new rows for agents launched this way. An earlier pass in this same unreleased cycle shipped this as one opt-in, standalone floating shell instead — corrected to per-agent embedded terminals and the standalone panel/setting removed outright (TICKET-0019)
- New agents default to a randomly generated human first name instead of a numbered "Agent N" label (TICKET-0016)

### Fixed
- Two external console windows briefly flashed on Windows roughly once a minute, even with the app idle and no agents running — the 60s live-usage poll's two `tokscale` calls each triggered a third-party bug where `tokscale`'s own JS shim runs the native binary via an un-hidden nested `spawnSync`, which our own (correctly hidden) outer spawn couldn't reach. `TokscaleService` now resolves and spawns the Windows platform binary directly, bypassing the vendor shim's un-hidden spawn entirely. Follow-up found while live-verifying that fix in the packaged app: the Usage panel failed outright with `spawn ...tokscale.exe ENOENT`, because the direct binary path resolved via `require.resolve()` pointed inside `app.asar`, which Windows can't execute (`spawn` isn't asar-aware the way `execFile` is) — now redirected to its `app.asar.unpacked` counterpart before spawning (TICKET-0029)
- `ptyHost.js` (hosts every agent's live terminal session) could crash with a native access violation when switching projects while more than one agent was running — unmounting every `AgentTerminal` at once fired `terminal:dispose` for each session back-to-back, and killing multiple ConPTY sessions concurrently is a known native-addon crash trigger on Windows. Session teardown is now serialized, waiting for each killed session to actually exit before the next one is killed (TICKET-0028)
- Switching tabs away from Agents and back showed visible console/cmd windows and restarted every running agent's real CLI session (sometimes appearing to trigger more than once for the same agent). Caused by two stacked issues: `TerminalService`'s fork of `ptyHost.js` was missing `windowsHide: true` (Windows shows a console window for a forked `node.exe` by default when spawned from a windowed parent like Electron), and `AgentView` unmounted/remounted on every tab switch, tearing down and re-spawning every running agent's terminal each time. `AgentView` now stays mounted (hidden via CSS instead of unmounted) like the rest of the app's persistent views (TICKET-0027)
- Every Codex agent failed immediately after its first prompt with `The 'codex-mini-latest' model is not supported when using Codex with a ChatGPT account.` — the hardcoded Codex model list (`codex-mini-latest`, `o3`, `o4-mini`) were raw API-key-only model slugs, rejected outright by a ChatGPT-subscription login (this machine's actual auth mode). Replaced with ChatGPT-account-compatible slugs read from the CLI's own local model cache. Follow-up: that fix only changed the create-agent dropdown, so Codex agents created before it kept relaunching with the stale slug already saved on their DB row and hitting the same error — `DBService` now runs a one-time startup migration that repairs any `codex` agent row still holding one of the old slugs (TICKET-0026)
- Leaving the Agents tab and returning to it (without switching projects) duplicated every agent card — for a running agent, a second real terminal/CLI process was spawned for the same agent, not just a visual duplicate. `AgentView`'s restore effect reran on every remount (tab switches unmount/remount the view, but the agent list lives in the Zustand store and isn't cleared on a tab switch) and re-added every already-present agent with no guard against duplicates (TICKET-0024)
- Codex agents couldn't launch at all — both the headless path and the new embedded terminal spawned `openai codex ...`, but `openai` on PATH is the unrelated openai-python SDK's CLI (subcommands `api`/`tools`/`migrate`/`grit`, no `codex` subcommand), not the real Codex CLI. Now spawns `codex` directly, with `permissionMode` mapped to its own `--sandbox`/`--ask-for-approval` flags the same way Claude's modes map to `--allowedTools`/`--dangerously-skip-permissions` (TICKET-0020)
- `DBService.init()` locating the sql.js WASM binary via a `__dirname`-relative path, which broke once the file was copied to `dist/` at build time — now resolved via `require.resolve('sql.js/dist/sql-wasm.js')` (TICKET-0017)
- Token tracking: Codex agents always showed 0 tokens (never got a JSON output mode to parse), Claude turns undercounted real usage (cache tokens were never read), and cost was a hardcoded, drifting pricing table. Fixed by adopting `tokscale` to read Claude's own local session transcripts for authoritative token + cost totals, reconciled asynchronously against each turn shortly after it completes so it never delays the response. Codex reconciliation is a known, deliberate gap — see architecture.md (TICKET-0018)

### Added
- `prompts.cache_read_tokens`, `prompts.cache_creation_tokens`, `prompts.cost_usd` columns; Token Dashboard now shows real cache token counts and prefers tokscale's real cost over the static estimate wherever available (TICKET-0018)

## [0.1.1] - 2026-07-24

### Added
- Delete button on stopped agent panes (TICKET-0011) — removes the agent from the interface without touching its audit history
- Automated tests for Claude stream parsing and permission policies.

### Fixed
- Production packaging now includes the renderer, preload, IPC handlers, and all main-process services under Electron's declared entry point.
- Prompt completion is tracked by a unique execution ID. Overlapping prompts are rejected rather than killing the prior process and risking audit-record corruption.
- CLI launch failures are surfaced to the user and recorded in the audit log.
- Database persistence writes a temporary file and atomically replaces the prior database.
- Agent responses and token counts never actually being saved to the database (TICKET-0012, TICKET-0013) — `DBService`'s write wrapper called `db.export()` (to persist to disk) immediately after every insert, and sql.js resets `last_insert_rowid()` to 0 as a side effect of `export()`. `logPrompt` read that id in a separate query *after* the export had already zeroed it, so every completed prompt's response/token update targeted a nonexistent row and was silently dropped. Fixed by reading the id before `export()` runs. A secondary bug in `AgentService` (stdout chunks not buffered across `data` events, dropping a split final `result` line) was fixed alongside it.
- Stopped agent panes disappearing entirely instead of showing history + the Delete button (TICKET-0011) — a redundant `removeAgent()` call was undoing the status update, and project/app restarts only restored agents that were still `running`

## [0.1.0] - 2026-07-19

### Added
- Electron + React 18 + Tailwind + Vite project scaffold
- SQLite database (better-sqlite3) with schema for projects, agents, prompts, settings
- IPC bridge between main and renderer processes
- Project switcher sidebar (add/remove/switch project folders)
- Multi-agent runner: spawn multiple Claude CLI or OpenAI Codex CLI processes per project
- Live streaming agent output in terminal-style panes
- Per-agent model selector (Claude: haiku/sonnet/opus/fable; Codex: codex-mini/o3/o4-mini)
- Prompt sending to running agents via stdin
- Full audit log: every prompt + response stored in SQLite with token counts and duration
- Searchable audit log view with prompt/response detail panel
- Token dashboard: daily bar charts, cost line chart, breakdown by model and task
- Estimated cost calculations per model
- Load balancer: auto-fallback to Codex when Claude hourly token usage exceeds threshold
- Token Optimization Advisor: one-click analysis with categorized suggestions
- Settings panel: default model, provider, fallback toggle, threshold
- scripts/setup.bat, scripts/run.bat, scripts/build.bat
