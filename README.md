# Agent Command Engine (ACE)

ACE runs Claude Code and Codex agents in separate terminals for each project. It keeps their tasks, status, and usage data together.
---

## Screenshots

**Agent Interface** - multi-agent runner with real interactive terminals per project

![Agent Interface](docs/screenshots/agent-interface.png)

**Usage** - live token usage dashboard across Claude and Codex

![Usage](docs/screenshots/usage.png)

---

## Features

- **Projects:** Open and switch between project folders.
- **Files:** Browse a project in a VS Code-style sidebar. Edit files in Monaco and save them to disk. The context menu can open files in Explorer or run executable files.
- **Agents:** Start several Claude Code or Codex agents in one project. Each has its own interactive terminal and remains available when you switch tabs or projects.
- **Names and status:** Agents receive a generated name and a title from their first prompt. Badges distinguish Starting, Active, known Waiting, completion, failure and lost sessions. Claude hooks provide detailed activity; Codex is not labelled Waiting without an input signal. A project can play a sound when an agent finishes.
- **Screenshots:** Capture a selected screen area from an agent card. ACE writes the image to `assets/images/screenshots/` and copies its path.
- **Usage:** Whole-machine quota and usage come from `tokscale`; project history is separately labelled and grouped by stable agent/session identities.
- **Notes:** Open Project Notes without a running agent. Search, edit and undo deletion; per-agent insertion pastes without submitting. See the [notes format](docs/agents/notes-format.md) before appending from scripts.
- **Usage bar:** The Agents tab shows each provider's used and available percentage, plus its reset time.
- **Models:** Choose the Claude or Codex model for an agent.
- **Push update:** This terminal action creates a ticket and a `feature/` or `bugfix/` branch, makes a local commit, then opens a pull request through `/push-update`.
- **One window:** A second launch focuses the existing window instead of starting another copy of ACE.

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

The next release bundles its third-party skill packs and credits directly;
there is no mandatory download or consent gate. Missing Claude project skills
are copied from the bundle without overwriting existing skills. Project Skills
shows Claude and Codex directories separately; a Claude skill does not imply
Codex support. ACE keeps its database and generated hooks in `Documents/ACE/`.

The release workflow now requires signing credentials, but a signed release
has not yet been verified. Follow the [release verification and offline update
instructions](docs/agents/release-delivery.md), not a signing claim inferred
from a successful local build.

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

Development uses Node.js 22. Install and authenticate whichever provider CLI
you use. Removing a global CLI is an explicit per-provider maintenance action
and also affects terminals outside ACE.

Automated checks:

```
cd src
npm test
npm run build
npm run package
```

Application build output is written to `src/dist`; installers are written to `releases`.
Ordinary builds do not bump versions or commit files. Release preparation takes
a full reviewed commit SHA and requires a clean tree; tagging and publishing
remain separate actions.

Editor saves check the loaded disk content before replacing a file. Conflicts
keep both the external file and the unsaved buffer until you choose what to
keep. Window close offers Save, Discard and Cancel. Main owns running PTYs:
renderer reattachment replays recent output; app quit ends sessions, and host
failure is reported as lost rather than silently starting another agent.

---

## Credits

Token usage tracking is built on [token-monitor](https://github.com/Javis603/token-monitor) by [Javis603](https://github.com/Javis603).

---

## Version

See `version.txt` and `src/package.json` for the current version, and
`CHANGELOG.md` for release history. Current milestone: Reliability Alpha.
