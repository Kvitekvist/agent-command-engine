# Changelog

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
