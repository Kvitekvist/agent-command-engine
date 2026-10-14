# TICKET-0171 — Chat view, plugin discovery, and session resume on restore

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-10-14

---

## Description

Four related changes to the agent terminal and side panels, found already
implemented and uncommitted in the working tree:

1. **Session resume on restore.** A restored agent (app reopened, or a card
   whose CLI process died while the app stayed open) now relaunches with
   `claude --resume <session-id>` instead of a brand-new `--session-id`, so
   its conversation picks back up instead of starting blank. `agents.session_id`
   is stamped in `DBService.recordAgentSession` so a later restore can read it
   back. `TerminalSvc.onState` now forwards every status transition
   (including back to `running`) instead of swallowing it, so a resumed
   card's badge updates.
2. **Chat view.** A toggle in the terminal toolbar switches between the raw
   xterm view and `ChatView.jsx`, a rendered view of the parsed transcript
   (`TranscriptService.js` reads Claude's and Codex's own transcript files).
   While chat view is active, a poller reads the CLI's numbered
   approval/permission menu off the hidden xterm buffer (`promptDetect.mjs`)
   so it can still be answered without switching back to the terminal.
3. **Plugin discovery.** `PluginDiscovery.js` reads Claude Code's own
   `~/.claude/plugins/installed_plugins.json` and `known_marketplaces.json`
   so the Plugins tab lists plugins already installed for the account
   instead of requiring every id to be typed in by hand.
4. **Panel polish.** Memories panel gets a Monaco editor (find/replace,
   Ctrl/Cmd+S save) and a file filter box, same pattern as the existing
   file editor. Skills/Plugins/MCP panel gets a search box per tab. Notes and
   the first-prompt questionnaire modals no longer close on an accidental
   backdrop click (`Modal`'s new `closeOnBackdrop` prop). `MemoriesPanel` is
   now lazy-loaded (pulls in Monaco, ~9MB minified) so it's no longer paid
   for by sessions that never open it.

## Reason

Shipping a release; this work was already written and tested but never
committed or logged.

## Implementation Plan

* [x] Session resume: `agentLaunch.mjs`, `DBService.js`, `handlers.js`, `AgentView.jsx`
* [x] Chat view: `ChatView.jsx`, `TranscriptService.js`, `promptDetect.mjs`, `AgentTerminal.jsx`
* [x] Plugin discovery: `PluginDiscovery.js`, `handlers.js`, `preload.js`, `ProjectSkillsPanel.jsx`
* [x] Panel polish: `MemoriesPanel.jsx`, `ProjectSkillsPanel.jsx`, `Modal.jsx`, `NotesPanel.jsx`, `App.jsx`

---

## Files Modified

- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/main/services/DBService.js`
- `src/main/services/agentLaunch.mjs`
- `src/main/services/PluginDiscovery.js` (new)
- `src/main/services/TranscriptService.js` (new)
- `src/renderer/App.jsx`
- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/components/ChatView.jsx` (new)
- `src/renderer/components/MemoriesPanel.jsx`
- `src/renderer/components/Modal.jsx`
- `src/renderer/components/NotesPanel.jsx`
- `src/renderer/components/ProjectSkillsPanel.jsx`
- `src/renderer/utils/promptDetect.mjs` (new)
- `src/renderer/views/AgentView.jsx`
- `src/tests/plugin-discovery.test.js` (new)
- `src/tests/prompt-detect.test.js` (new)
- `src/tests/transcript-service.test.js` (new)

## Testing

`npm test` — 155 tests, 154 pass, 1 skipped (POSIX-only, expected on
Windows). `npm run build` succeeds.

## Result

Committed as part of the v0.1.47 release. Live verification of session
resume across an app restart, and of the chat view against a real Claude/Codex
session, is still outstanding — left `Awaiting verification` rather than
`Closed`.

## Notes

Found fully written and uncommitted at the start of this session; this
ticket documents it retroactively so the release has a ticket to point to.

---
