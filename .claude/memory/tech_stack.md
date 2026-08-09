# Technology Stack

## Project

- Name: Claude Projects Interface
- Version: 0.1.1
- Created: 2026-07-19
- Target: Windows desktop; Electron also supports macOS packaging

## Runtime and UI

| Component | Version | Purpose |
| --- | --- | --- |
| Node.js | 20+ | Development runtime |
| Electron | 31.7 | Desktop shell and main process |
| React | 18.3 | Renderer UI |
| Tailwind CSS | 3.4 | Styling |
| Zustand | 4.5 | Renderer state |
| Recharts | 2.12 | Usage charts |
| sql.js | 1.12 | In-process SQLite |
| node-pty | — | Real interactive PTY sessions per agent card (forked into its own `ptyHost.js` process) |
| @xterm/xterm | — | Renders each agent's PTY session in the UI |
| @monaco-editor/react + monaco-editor (pinned 0.50.0) | — | VS Code's own editor, powering the Sidebar file explorer |
| tokscale | — | Reads Claude Code's/Codex's own local session transcripts for authoritative token/cost usage and live subscription quota |

## Build and Package Management

- Package manager: npm
- Renderer build: Vite
- Main-process build: `src/scripts/build-main.js`
- Installer: Electron Builder with NSIS
- Application output: `src/dist`
- Installer output: `releases`

## Storage

The application keeps one SQLite database in Electron's userData directory.
`sql.js` holds the database in memory; DBService persists it to disk after
mutations using temporary-file replacement.

## External Tools

- Claude CLI (`claude`), authenticated by the CLI
- OpenAI CLI (`openai`), authenticated by the CLI
- Git

No application-specific environment variables or hosted services are required.
