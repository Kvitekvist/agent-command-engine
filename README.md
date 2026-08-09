# Claude Projects Interface (CPI)

A specialized Electron desktop application for managing Claude and OpenAI Codex agents across multiple projects. Built to benchmark AI project frameworks by tracking speed, token usage, and documentation quality.

---

## Features

- **Project Switcher** — open and switch between any number of project folders
- **File Explorer** — a VS Code-style file tree per project in the Sidebar; click a file to open and edit it in a real Monaco editor, save straight to disk
- **Multi-Agent Runner** — launch multiple Claude CLI or OpenAI Codex agents simultaneously within a project; each gets its own real interactive terminal (opens in the project's folder, runs the actual CLI) rather than a scripted chat pane
- **Full Audit Log** — every prompt sent and every response received through the (currently unused by the UI) headless agent path is stored in SQLite for auditing and result reproduction; historical only until a future update reconciles it against the interactive terminal path too
- **Token Dashboard** — per-prompt, per-task, and per-project token tracking with bar charts, line charts, and cost estimates by model; same historical-only caveat as the audit log above
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
| Database | SQLite via sql.js (WASM) |
| Charts | Recharts |
| State | Zustand |
| Terminal | node-pty + xterm.js |
| Editor | Monaco (`@monaco-editor/react`) |
| AI providers | Claude CLI, OpenAI Codex CLI |

---

## Quick Start

```
scripts\setup.bat   # install dependencies (run once)
scripts\run.bat     # start in development mode
scripts\build.bat   # build for production
```

Requires: Node.js 20+, Claude Code CLI (`claude`), OpenAI CLI (`openai`) installed and authenticated.

Automated checks:

```
cd src
npm test
npm run build
npm run package
```

Application build output is written to `src/dist`; installers are written to `releases`.

---

## Version

0.1.1 — Reliability alpha
