# TICKET-0079 — Introduce a main-owned terminal-session model and explicit lifecycle

**Status**

Open

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Introduce a main-owned terminal-session model and explicit lifecycle policy for
agents across project changes, renderer remounts, host crashes, and idle limits.

## Reason

Every visited project remains mounted in the renderer to preserve PTYs, causing unbounded retained UI/session state.

## Implementation Plan

### Audit continuation, 2026-09-14

TerminalService owns sessions, replay sequence/PID/state and stop; renderer detach never kills a PTY. Remove activeProc placeholders. Do not evict idle work.

2026-09-13: AUDIT-14/27. Bind agent IDs to PTY IDs/PIDs in TerminalService,
retain bounded output for reconnect, stop in main, report host loss and prior
process sessions as lost. No idle eviction or automatic fresh launches.

* [ ] Define background-session and eviction behavior
* [ ] Model sessions separately from visible cards, with output ring buffers
* [ ] Add reconnect, crash/resume, concurrency-limit, and idle-eviction behavior
* [ ] Surface running/awaiting-input/idle/exited/lost states to global consumers
* [ ] Add lifecycle and recovery tests

## Files Modified

Audit continuation: TerminalService.js, AgentService.js, ptyHost.js, handlers.js, AgentTerminal.jsx, AgentView.jsx, ProcessesView.jsx; terminal-lifecycle tests, smoke-pty.js and smoke-main.js.

---

## Testing

Audit continuation: Reconnect, pending-stop and host-loss regressions; Windows packaged PTY I/O passed. The isolated real-main smoke retains the same PTY/PID across renderer reload, launches its harmless provider once and verifies Stop terminates that child process. node-pty emits an AttachConsole teardown warning despite successful termination. Remaining: real-provider reload, host-failure and macOS window reopen journeys.

* [ ] `npm test`
* [ ] `npm run build`

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

---

## Closed

---
