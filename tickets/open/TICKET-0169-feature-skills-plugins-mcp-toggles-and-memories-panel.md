# TICKET-0169 — Skills / Plugins / MCP toggles, Memories panel, sidebar reorganisation

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-30

---

## Description

Three changes that sat in the working tree without a ticket, recorded here
so they can be committed with the fixes found in review (TICKET-0166,
TICKET-0167):

- The Project Skills panel becomes **Skills / Plugins / MCP**, with a tab per
  kind. Each project skill, `.mcp.json` server and registered plugin gets an
  on/off switch that writes the personal `.claude/settings.local.json`
  (`skillOverrides`, `enabledMcpjsonServers` / `disabledMcpjsonServers`,
  `enabledPlugins`), never the shared `.claude/settings.json`. Claude only;
  Codex has no equivalent switches.
- A **Memories** panel lists `.claude/memory/*.md` for the active project and
  edits them in a plain textarea, saving through the conflict-aware writer.
- Sidebar navigation: adds Memories, renames "Usage (whole machine)" to
  "Usage", gives Prompt Score its own icon, and drops Settings from the
  sidebar (it stays in the application menu, Ctrl/Cmd+,).

---

## Reason

Toggling a skill, plugin or MCP server meant hand-editing JSON, and memory
files were only reachable through the file tree. Settings duplicated the
application menu entry.

---

## Implementation Plan

* [x] `ProjectSkillsPanel.jsx`: tabs, `Toggle`, settings writes via `claudeSettings.mjs`.
* [x] `claudeSettings.mjs`: read/write `.claude/settings.local.json` (hardened in TICKET-0166).
* [x] `MemoriesPanel.jsx` and its route in `App.jsx` (race fixes in TICKET-0167).
* [x] Sidebar NAV and the launch-bar button label in `AgentView.jsx`.
* [x] Renderer smoke follows the nav change: "📊Usage", and Settings through the menu-navigate path.

---

## Files Modified

- `src/renderer/components/ProjectSkillsPanel.jsx`
- `src/renderer/utils/claudeSettings.mjs` (new)
- `src/renderer/components/MemoriesPanel.jsx` (new)
- `src/renderer/App.jsx`
- `src/renderer/components/Sidebar.jsx` (NAV)
- `src/renderer/views/AgentView.jsx`
- `src/scripts/smoke-renderer.js`, `src/scripts/smoke-renderer-preload.js`

---

## Testing

- Renderer smoke passes end to end, including Settings reached through the
  application-menu path and the Memories read-race check from TICKET-0167.
- Settings-file behaviour: `tests/claude-settings.test.js` (TICKET-0166).
- Seen working in the running dev build on 2026-09-29 (Skills tab with
  toggles, Memories listing and opening `architecture.md`).
- Not verified: that Claude Code honours each written key (`skillOverrides`
  in particular) in a fresh session after a toggle.

---

## Result

Committed with TICKET-0164 to TICKET-0167. Needs a live check that a toggled
skill, plugin and MCP server actually change what a new Claude session loads.

---

## Notes

Plugins are not auto-discovered: the Plugins tab lists ids already in
`enabledPlugins`, and new ones are added by id.

---

## Closed

Pending.
