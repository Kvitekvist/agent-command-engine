# Agent Command Engine (ACE)

A specialized Electron desktop application for managing Claude and OpenAI Codex agents across multiple projects. Built to benchmark AI project frameworks by tracking speed, token usage, and documentation quality.

---

## Screenshots

**Agent Interface** — multi-agent runner with real interactive terminals per project

![Agent Interface](docs/screenshots/agent-interface.png)

**Usage** — live token usage dashboard across Claude and Codex

![Usage](docs/screenshots/usage.png)

---

## Features

- **Project Switcher** — open and switch between any number of project folders
- **File Explorer** — a VS Code-style file tree per project in the Sidebar; click a file to open and edit it in a real Monaco editor, save straight to disk; right-click a file for Open / Open in Explorer / Run (executable-like files only)
- **Multi-Agent Runner** — launch multiple Claude CLI or OpenAI Codex agents simultaneously within a project; each gets its own real interactive terminal (opens in the project's folder, runs the actual CLI) rather than a scripted chat pane; sessions survive switching tabs and switching projects
- **Auto-Title** — each agent's card label updates from the first line you submit into its terminal (e.g. "fix login bug"), so several running agents are easy to tell apart at a glance instead of only showing a random default name
- **Screenshot Capture** — drag-to-select a region of the screen (including ACE itself) from any running agent's card; saves into that project's own `.cpi/screenshots/` folder (auto-`.gitignore`d) with the path copied to the clipboard, ready to paste into the agent's terminal
- **Full Audit Log** — every prompt sent and every response received through the (currently unused by the UI) headless agent path is stored in SQLite for auditing and result reproduction; historical only until a future update reconciles it against the interactive terminal path too
- **Live Token Usage Dashboard** (default tab) — real Claude/Codex subscription quota (5-hour rolling + weekly limits with reset countdowns) and today's usage by model and by project, sourced live from `tokscale`'s own account data rather than ACE's audit log
- **Agents Tab Usage Bar** — compact % used / % available / reset countdown per provider, shown above the Agents tab toolbar so quota is visible without switching tabs; shares the same live data as the dashboard above
- **Token Dashboard (History)** — per-prompt, per-task, and per-project token tracking with bar charts, line charts, and cost estimates by model; same historical-only caveat as the audit log above
- **Model Selector** — dropdown to choose Claude or Codex model per agent
- **Load Balancing** — automatically falls back to OpenAI Codex when Claude token usage exceeds a configurable hourly threshold
- **Optimization Advisor** — one-click analysis of recent prompts with actionable suggestions for reducing token spend
- **Single Window** — ACE runs as a single instance; launching it again focuses the already-open window instead of starting a second one, so keyboard input and the local database always have exactly one owner

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

**Windows:**
```
scripts\setup.bat   # install dependencies (run once)
scripts\run.bat     # start in development mode
scripts\build.bat   # build for production
```

**macOS / Linux:**
```
chmod +x scripts/*.sh
scripts/setup.sh    # install dependencies (run once)
scripts/run.sh      # start in development mode
scripts/build.sh    # build for production
```

Requires: Node.js 20+, Claude Code CLI (`claude`), OpenAI Codex CLI (`codex`) installed and authenticated.

Automated checks:

```
cd src
npm test
npm run build
npm run package
```

Application build output is written to `src/dist`; installers are written to `releases`.

---

## Credits

Token usage tracking is built on [token-monitor](https://github.com/Javis603/token-monitor) by [Javis603](https://github.com/Javis603).

---

## Version

0.1.1 — Reliability alpha
