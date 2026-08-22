# ACE Conventions

- Use CommonJS in the Electron main process and the existing ES-module React
  style in the renderer.
- Keep business logic out of React components and IPC registrars when a
  focused service or hook can own it.
- Prefer pure helpers for parsing, policy, and command construction; add
  Node test-runner coverage for those helpers.
- Preserve `contextIsolation: true` and `nodeIntegration: false`.
- Do not introduce shell command concatenation when `spawn(command, args)`
  can preserve argument boundaries.
- Update the active ticket's plan, files, and verification result as work
  advances.

The older [coding-conventions memory](../../.claude/memory/coding_conventions.md)
contains generic conventions and can be consulted for additional context.
