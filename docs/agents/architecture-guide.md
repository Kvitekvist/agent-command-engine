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

## Audit boundary contracts (2026-09-14)

- Registration consumes a canonical folder chosen by the native dialog or
  created by main. Agent/history project IDs and paths must identify the same
  database record. Registration is not a renderer-granted capability.
- IPC senders must be the current ACE webContents and its main frame. Navigation,
  redirects and new windows are denied; the screenshot overlay keeps its own IPC.
- ProjectPath checks real paths, including the nearest existing parent for new
  files. In-project links are followed; escaping links/junctions are rejected.
  This is not an OS sandbox for executed project scripts or a defense against
  adversarial concurrent link swaps between filesystem calls.
- FileService writes to a sibling temporary file and replaces the target only
  after checking the supplied loaded content. NotesService owns ID-based mutations
  and uses the same conflict check. External writers still have a small final
  check/rename race; neither API claims filesystem-wide transactions.
- TerminalService maps agent IDs to actual PTY IDs/PIDs and lifecycle state.
  Renderer unmount detaches, explicit stop/removal disposes. Reattachment replays
  the last 256K characters with sequence numbers to avoid lost/duplicate startup
  output. Host loss is reported, never silently replaced with a fresh CLI session.
- Main requests window close through `window:requestClose`; renderer replies on
  `window:closeDecision` after Save, Discard or Cancel. Save failures do not approve
  close. Main tears down services only after approval when quitting. macOS window
  close keeps sessions alive for reattachment.

## Detailed history

The legacy [architecture memory](../../.claude/memory/architecture.md) has
feature-level notes and troubleshooting history. Consult it for a named
feature or ticket; this guide is the default architectural context.
