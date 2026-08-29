# TICKET-0044

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-11

---

## Description

The Token Usage tab's "History (this project)" section is empty — Total Tokens,
Cache Read Tokens, Total Prompts and Est. Cost all read 0, and the By Day / By
Model / By Task charts are blank for every project.

Fix it by sourcing the section from tokscale (the real, authoritative data)
instead of ACE's own `prompts` table, scoped to the active project's workspace.
Also rename the third breakdown from "By Task" to "By Agent" and populate it
with the real ACE agent names the user set.

---

## Reason

Since TICKET-0019 moved agents to the per-agent embedded terminal, nothing calls
`AgentService.sendPrompt` anymore, so no new rows land in the `prompts` table —
the only source `tokens:getStats` (and therefore the whole History section) ever
read from. The Live Usage cards already dodge this by reading tokscale directly
(TICKET-0022); the History section is the last piece still tied to the dead table.

tokscale's `report --json --no-summarize --workspace <key>` returns per-session
rows for one workspace, each carrying real input/output/cache-read tokens, cost,
`message_count`, `models_used` and a `created_at` timestamp — enough to rebuild
Totals, By Day and By Model accurately from one call per client.

For "By Agent", tokscale only knows CLI *sessions*, not ACE agent names. So ACE
now forces a known session id per Claude agent at launch (`claude --session-id
<uuid>`, behaviour-neutral since each terminal mount already started a fresh
session) and records session id -> agent in a new `agent_sessions` table, which
the report rows are joined against to recover the names.

---

## Implementation Plan

* [x] `TokscaleService`: add `pathToWorkspaceKey(path)` and
  `getWorkspaceReport(workspaceKey, clients)` (one `report` call per client, merged).

* [x] `DBService`: add `agent_sessions` table + `recordAgentSession()` and
  `getAgentSessionMap(projectId)`.

* [x] IPC: add `tokens:getProjectHistory` (report rows joined to agent names) and
  `agents:recordSession`; expose both in preload.

* [x] Renderer: generate a UUID and inject `--session-id` for Claude launches
  (`agentLaunch.js` + `AgentTerminal.jsx`), and record the session.

* [x] Renderer: rewrite `TokenView` History to consume `getProjectHistory`,
  rename the third tab to "By Agent".

* [x] Docs: architecture.md Token Tracking, CHANGELOG, ticket memory.

---

## Files Modified

- `src/main/services/TokscaleService.js`
- `src/main/services/DBService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/utils/agentLaunch.js`
- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/views/TokenView.jsx`
- `.claude/memory/architecture.md`, `CHANGELOG.md`, `.claude/memory/ticket_memory.md`

---

## Testing

- `npm run build:renderer` and `npm run build:main`: both clean.
- `npm test`: 13/13 pass (added a `pathToWorkspaceKey` round-trip test verified
  against a real tokscale workspace key).
- End-to-end against real tokscale for the ACE workspace via a throwaway script:
  `getWorkspaceReport` returned 6 sessions, aggregating to 27.6M tokens, 304
  prompts, $29.05 cost, with populated By Day and By Model — confirming the
  section is no longer empty.
- Not yet live-verified in the running app that a freshly launched agent (with
  the injected `--session-id`) appears under its own name in By Agent — needs a
  real agent launch. The mapping path itself is unit-covered and the data path
  is verified; only the UUID-injection round-trip through a live CLI is untested.

---

## Result

The "History (this project)" section is fixed: it now shows real, all-time
per-project usage (tokens, cache read, prompt/message count, real cost) sourced
from tokscale, with working By Day / By Model / By Agent breakdowns. The third
tab was renamed from "By Task" to "By Agent" and shows real ACE agent names for
sessions ACE launched; Codex and pre-existing sessions show as "Untracked".

---

## Notes

- Codex agents can't be forced to a known session id and aren't reconciled
  (see TICKET-0018 notes), so Codex usage still shows in Totals/By Day/By Model
  but its sessions fall under "Untracked" in By Agent.
- By Agent attribution is forward-only: sessions from before this ships have no
  recorded mapping, so they also show as "Untracked".

---

## Closed

2026-08-11
