# ACE Architecture Guide

## Boundaries

```text
React renderer
  -> preload bridge (`window.ace`)
  -> Electron IPC handlers
  -> domain services / database / PTY host
```

- `src/renderer/`: React views, components, Zustand state, and UI utilities.
- `src/main/preload.js`: the deliberately limited renderer API.
- `src/main/ipc/`: request routing only; domain work belongs in services.
- `src/main/services/`: agent lifecycle, persistence, files, token data,
  screenshots, and terminal-host supervision.
- `src/main/ptyHost.js`: forked native-PTY process that keeps node-pty out of
  Electron's ABI and crash boundary.

## Change guidance

- An IPC change normally requires matching handler, preload, renderer, and
  test updates.
- A terminal change can involve `AgentTerminal.jsx`, `TerminalService`, and
  `ptyHost.js`; preserve session cleanup and host-restart behavior.
- Database changes require a forward migration because user data persists in
  Electron's `userData` directory.
- File operations must continue to enforce the selected project root.

## Detailed history

The legacy [architecture memory](../../.claude/memory/architecture.md) has
feature-level notes and troubleshooting history. Consult it for a named
feature or ticket; this guide is the default architectural context.
