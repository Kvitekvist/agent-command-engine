# TICKET-0031

**Status**

Open

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

---

## Testing

---

## Result

---

## Notes

---

## Closed
