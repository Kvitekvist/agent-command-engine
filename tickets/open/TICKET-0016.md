# TICKET-0016

**Status**

Open

**Type**

Feature

**Priority**

Low

**Created**

2026-07-24

---

## Description

When launching a new agent from the Agent view, auto-generate a random
human first name (e.g. "Marcus", "Priya") as the default label instead of
the current numbered "Agent 1", "Agent 2", ... scheme.

---

## Reason

User requested that every new agent get a distinct, random person name
rather than a generic "Agent N" label, to make agents easier to tell apart
at a glance.

---

## Implementation Plan

* [x] Add a shared name-pool util (`agentNames.js`) with a `generateAgentName`
      helper that returns a random human first name, avoiding collisions with
      labels currently in use
* [x] Replace the `'Agent 1'` initial state and numeric-increment logic in
      `AgentView.jsx` with calls to `generateAgentName`
* [ ] Manual verification: launch several agents in a row, confirm each gets
      a distinct random name and the label field remains freely editable

---

## Files Modified

- src/renderer/utils/agentNames.js (new)
- src/renderer/views/AgentView.jsx

---

## Testing

Manual — see Implementation Plan verification step above.

---

## Result

Implemented. Not yet manually verified in a running app (no live session in
this environment).

---

## Notes

---

## Closed

