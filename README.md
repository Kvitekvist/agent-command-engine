# Claude Projects Interface (CPI)

A specialized Electron desktop application for managing Claude and OpenAI Codex agents across multiple projects. Built to benchmark AI project frameworks by tracking speed, token usage, and documentation quality.

---

## Features

- **Project Switcher** — open and switch between any number of project folders
- **Multi-Agent Runner** — launch multiple Claude CLI or OpenAI Codex agents simultaneously within a project; each gets its own terminal pane with live streaming output
- **Full Audit Log** — every prompt sent and every response received is stored in SQLite for auditing and result reproduction
- **Token Dashboard** — per-prompt, per-task, and per-project token tracking with bar charts, line charts, and cost estimates by model
- **Model Selector** — dropdown to choose Claude or Codex model per agent
- **Load Balancing** — automatically falls back to OpenAI Codex when Claude token usage exceeds a configurable hourly threshold
- **Optimization Advisor** — one-click analysis of recent prompts with actionable suggestions for reducing token spend

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| UI | React 18 + Tailwind CSS |
| Bundler | Vite |
| Database | SQLite via better-sqlite3 |
| Charts | Recharts |
| State | Zustand |
| AI providers | Claude CLI, OpenAI CLI |

---

## Quick Start

```
scripts\setup.bat   # install dependencies (run once)
scripts\run.bat     # start in development mode
scripts\build.bat   # build for production
```

Requires: Node.js 20+, Claude Code CLI (`claude`), OpenAI CLI (`openai`) installed and authenticated.

---

## Version

0.1.0 — Milestone 1: Core Infrastructure
