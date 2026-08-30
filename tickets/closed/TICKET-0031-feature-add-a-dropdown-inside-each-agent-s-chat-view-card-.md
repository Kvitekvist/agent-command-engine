# TICKET-0031 — Add a dropdown inside each agent's chat view (card) that lets the user

**Status**

Closed

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-09

---

## Description

Add a dropdown inside each agent's chat view (card) that lets the user
change the model being used for that agent without leaving the chat —
i.e. without stopping/deleting and recreating the agent.

---

## Reason

Promoted from `WISHLIST.md` item 1. Currently `ModelSelector`
(`src/renderer/components/ModelSelector.jsx`) is only wired into the "new
agent" creation form in `AgentView.jsx` (sets local `model` state used by
`startAgent`). Once an agent is running, its model is shown as static
read-only text (`<span>{agent.model}</span>`, `AgentView.jsx:207`) with no
way to change it in place.

---

## Implementation Plan

* [ ] Determine whether a running agent's model can be changed mid-session
      (i.e. does the `claude`/`codex` CLI process support switching model
      on a live session, or does changing model require a fresh process)
* [ ] Add IPC/service support to change an agent's model — either an
      in-place switch if the CLI supports it, or a controlled
      stop-and-relaunch that preserves the agent's identity/history if not
* [ ] Render `ModelSelector` inside each agent's chat card (replacing the
      static `agent.model` text), scoped to that agent, wired to the new
      change-model path
* [ ] Persist the updated model on the agent row in the DB so it survives
      restore-on-reopen
* [ ] Manual verification: change model on a running agent mid-chat,
      confirm the next prompt uses the new model and prior scrollback is
      preserved

---

## Files Modified

- `src/main/ipc/handlers.js`, `src/main/preload.js`,
  `src/main/services/DBService.js`, `src/renderer/views/AgentView.jsx` —
  removed the partial `agents:changeModel` / `changeAgentModel` /
  `updateAgentModel` scaffolding and the unused `AgentPane` state

## Testing

---

## Result

Won't solve. Post-TICKET-0019 each agent card is a real interactive PTY
running `claude`/`codex` directly (`AgentTerminal.jsx`), not a headless
`AgentService` session. The scaffolded `agents:changeModel` handler
restarts the `AgentService` record, which is *not* what the visible
terminal runs, so it changed nothing on screen — that's why the UI was
never wired. A working version would mean either typing a provider- and
version-specific `/model <id>` into the PTY (fragile; Claude and Codex
differ and neither reliably takes a full catalog id) or remounting the
terminal, which drops the scrollback the ticket requires. Not worth it:
stop the agent and launch a new one with the desired model. The dead
scaffolding has been removed.

## Notes

---

## Closed

2026-08-30
