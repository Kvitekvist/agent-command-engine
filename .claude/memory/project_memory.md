# Project Memory

## Project Name
Claude Projects Interface (CPI)

## Project Vision
A specialized Electron desktop application that provides a powerful interface for managing Claude (and OpenAI Codex) AI agents across multiple projects. The goal is to benchmark different project frameworks by tracking speed, token usage, and documentation quality — while keeping a full audit trail of every prompt and response for reproducibility.

---

## Current Milestone
**Milestone 1 — Core Infrastructure**
Bootstrap Electron + React app with project switcher, multi-agent runner, audit log, and token tracking.

---

## Active Priorities
* Scaffold Electron + React + SQLite project (TICKET-0001)
* Build project switcher sidebar (TICKET-0002)
* Build multi-agent runner with Claude CLI subprocess (TICKET-0003)

---

## Tech Stack
- Electron (main process)
- React 18 + Tailwind CSS (renderer process)
- Vite (bundler for renderer)
- better-sqlite3 (local SQLite database)
- Recharts (token usage visualization)
- Node.js child_process (spawn claude CLI and openai codex CLI)

---

## Technical Debt
- None yet

---

## Known Issues
- None yet

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
- One SQLite DB per project folder (.cpi/db.sqlite inside each project)
- Current template project: the AI Project Bootstrap in this repo
