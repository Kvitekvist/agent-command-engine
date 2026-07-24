# Project Memory

## Project Name
Claude Projects Interface (CPI)

## Project Vision
A specialized Electron desktop application that provides a powerful interface for managing Claude (and OpenAI Codex) AI agents across multiple projects. The goal is to benchmark different project frameworks by tracking speed, token usage, and documentation quality — while keeping a full audit trail of every prompt and response for reproducibility.

---

## Current Milestone
**Milestone 2 — Reliability Alpha**
Make process execution, persistence, packaging, and provider behavior dependable.

---

## Active Priorities
* Verify restored stopped-agent behavior manually (TICKET-0011)
* Add end-to-end provider contract tests for Claude and Codex
* Replace whole-database export-on-write if audit volume causes UI stalls

---

## Tech Stack
- Electron (main process)
- React 18 + Tailwind CSS (renderer process)
- Vite (bundler for renderer)
- sql.js (local SQLite database persisted in Electron userData)
- Recharts (token usage visualization)
- Node.js child_process (spawn claude CLI and openai codex CLI)

---

## Technical Debt
- `package.json` lives in `src/`, not the repo root — `node_modules` is at
  `src/node_modules`. Scripts/tests that shell out to `node` need to run from
  `src/` (or reference `src/node_modules`) or `require('electron')` etc. won't
  resolve.

---

## Known Issues
- TICKET-0011 (restore stopped agents + Delete button) is implemented but its
  manual UI verification step (stop an agent, switch projects, confirm cards +
  history reappear) hasn't been run yet.

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
