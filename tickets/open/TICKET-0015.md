# TICKET-0015 — Replace the Electron/Node/React stack with a native .NET 8 (WPF)

**Status**

Open

**Type**

Enhancement

**Priority**

High

**Created**

2026-07-24

---

## Description

Replace the Electron/Node/React stack with a native .NET 8 (WPF) desktop
application. The user does not want a background Node/Vite server process —
they want a single native process, similar to what a C#/C++ desktop app
provides.

---

## Reason

Electron requires a Node.js main process and (during development) a Vite dev
server, which the user experienced as an unwanted "server thing running in
background" (see TICKET-0010's port-5173-contention fix). A native .NET 8
desktop app runs as one process with no dev server, while still meeting the
existing Windows-desktop target and keeping local SQLite storage.

This is a full rewrite, not an incremental migration: the React renderer,
IPC bridge, and Node-based services are all replaced. It supersedes
Electron as the primary stack going forward; the Electron app under `src/`
is kept temporarily as a reference until the new stack reaches feature
parity, then removed.

---

## Implementation Plan

* [x] Scaffold a .NET 8 solution: WPF app project, Core class library, xunit test project
* [x] Port the SQLite schema and DBService (including the last_insert_rowid-before-save
      ordering fix from TICKET-0013) to a C# DbService using Microsoft.Data.Sqlite
* [x] Port AgentService (spawn/stream `claude`/`codex` CLI subprocesses) and LoadBalancer to C#
* [x] Build a minimal WPF shell (MainWindow + project sidebar) wired to DbService as a
      walking skeleton, proving the new stack runs end to end
* [ ] Port remaining UI views (Agent Pane, Audit Log, Token Dashboard, Optimization
      Advisor, Settings) — tracked as follow-up tickets, not done in this pass
* [x] Add .NET setup/build/clear_cache/run scripts
* [x] Update tech_stack.md, architecture.md, project_memory.md, README, CHANGELOG
* [ ] Remove the Electron app under `src/` once the .NET app reaches feature parity
      (separate future ticket — not done here)

---

## Files Modified

See commit for this ticket.

---

## Testing

`dotnet build` on the new solution; `dotnet test` for the Core test project.

---

## Result

Walking skeleton in place: solution builds, WPF shell launches, DbService
creates/reads the SQLite schema, AgentService/LoadBalancer ported. Full UI
parity is out of scope for this ticket and will continue under follow-up
tickets.

---

## Notes

This is a milestone-level change (new "Milestone 3 — .NET Migration"), not a
routine feature. Subsequent tickets should reference this one for the
remaining view ports and the Electron removal step.

---

## Closed

