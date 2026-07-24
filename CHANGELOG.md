# Changelog

## [Unreleased]

### Added
- New agents default to a randomly generated human first name instead of a numbered "Agent N" label (TICKET-0016)

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
