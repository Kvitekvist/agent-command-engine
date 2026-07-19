# Project Architecture

## Overview
Claude Projects Interface (CPI) is an Electron desktop application with a React renderer. The main process manages child processes (AI CLI tools), the SQLite database, and file system access. The renderer provides the React UI. IPC channels bridge the two.

---

## Components

### User Interface (Renderer — React + Tailwind)
- **Sidebar**: project list, switcher, active project indicator
- **Agent Pane**: per-agent terminal-style output, start/stop controls, model selector
- **Audit Log View**: searchable table of all prompts + responses
- **Token Dashboard**: Recharts charts per prompt/task/project; cost estimates
- **Optimization Advisor**: triggered by button; analyzes recent prompts, returns suggestions
- **Settings**: default model, load-balance threshold

### Main Process (Node.js / Electron)
- Manages child processes for `claude` CLI and `openai` CLI
- Reads/writes SQLite via better-sqlite3
- Handles file system dialogs (project folder picker)
- Exposes IPC handlers to renderer

### Database (SQLite — cpi.db in Electron userData)
- `projects` — id, name, path, created_at
- `agents` — id, project_id, label, provider, model, status
- `prompts` — id, agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, duration_ms, created_at
- `settings` — key, value

### Services (main process)
- **AgentService**: spawns/kills CLI processes, streams output via IPC
- **DBService**: all SQLite reads/writes
- **TokenParser**: parses token counts from CLI JSON output
- **LoadBalancer**: decides provider based on credit status

---

## Folder Responsibilities
```
src/
  main/           — Electron main process
    services/     — AgentService, DBService, LoadBalancer, TokenParser
    ipc/          — IPC handler registrations
  renderer/       — React app
    components/   — Reusable UI components
    views/        — AgentView, AuditView, TokenView, SettingsView
    hooks/        — Custom React hooks
    store/        — Zustand state
  shared/         — Types and constants shared between main and renderer
```

---

## Dependencies
| Package | Reason |
|---|---|
| electron | Desktop app shell |
| vite + @vitejs/plugin-react | Renderer bundling |
| react 18 + react-dom | UI framework |
| tailwindcss | Utility-first styling |
| better-sqlite3 | Synchronous SQLite (main process) |
| recharts | Token usage charts |
| zustand | Renderer state management |
| electron-builder | Package to .exe |

---

## Design Principles
- Main process owns all I/O (DB, file system, child processes)
- Renderer is pure UI — sends IPC requests, renders results
- Every AI interaction is logged before and after (audit-first)
- Claude and Codex implement the same provider interface

---

## Future Improvements
- WebSocket-based agent output stream
- Plugin system for additional AI providers
- Prompt replay for reproducibility
