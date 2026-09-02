# Agent Command Engine (ACE)

ACE is a desktop app for running and managing AI coding agents in a controlled workspace. Start agent sessions, work with them in interactive terminals, and keep tasks and projects organized in one place.
---

## Screenshots

**Agent Interface** - multi-agent runner with real interactive terminals per project

![Agent Interface](docs/screenshots/agent-interface.png)

**Usage** - live token usage dashboard across Claude and Codex

![Usage](docs/screenshots/usage.png)

---

## Features

- **Project switcher** — Add and switch between project folders.
- **File explorer** — Browse each project's files in a VS Code-style sidebar. Open and edit files in Monaco, save directly to disk, or right-click to open in Explorer or run executable files.
- **Multi-agent runner** — Run several Claude CLI or OpenAI Codex agents in the same project. Each agent has its own interactive terminal, starts in that project's folder, and stays available when you switch tabs or projects.
- **Agent identity and status** — Each agent has a generated name and a title based on its first prompt. Status badges show **Running**, **Waiting**, **Done**, or **Error** using Claude Code lifecycle hooks. You can enable a completion sound for each project.
- **Screenshot capture** — Select any screen region, including ACE, from a running agent card. ACE saves it to `.ace/screenshots/`, adds the directory to `.gitignore`, and copies the path so you can paste it into the agent terminal.
- **Live token usage dashboard** — The default tab shows Claude and Codex subscription quotas, reset countdowns, and today's usage by model, project, and session from `tokscale` account data.
- **Agents tab usage bar** — See each provider's percentage used, percentage available, and reset time above the Agents toolbar.
- **Model selector** — Choose a Claude or Codex model for each agent.
- **Push update** — From an agent terminal, create a ticket, make a `feature/` or `bugfix/` branch, commit the change locally, and open a pull request through the `/push-update` skill.
- **Single window** — Opening ACE again focuses the existing window, keeping keyboard input and the local database with one app instance.

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

## Install

**macOS** - installs the latest release straight into `/Applications`, no manual download:
```
curl -fsSL https://raw.githubusercontent.com/Kvitekvist/agent-command-engine/main/scripts/install-mac.sh | bash
```
Builds are unsigned, so first launch needs a right-click > Open the very first time (the script already strips the quarantine flag, so this is a one-time Gatekeeper confirmation, not an error).

**Windows** - download the installer or portable exe from the [latest release](https://github.com/Kvitekvist/agent-command-engine/releases/latest).

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

See `version.txt` and `src/package.json` for the current version, and
`CHANGELOG.md` for release history. Current milestone: Reliability Alpha.
