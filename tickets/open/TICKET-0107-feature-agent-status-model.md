# TICKET-0107 — Agent identity + live status model

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-02

---

## Description

Two coupled changes to how an agent card is identified and how its status is
shown. They land together because they rewrite the same rows, IPC payloads and
JSX hunks.

1. **Identity split.** The single `label` column becomes `agent_name`
   (the stable, generated card name) + `session_title` (the auto-generated
   or user-set title for the current work). `agents` and `agent_sessions`
   both migrate; the old `title_set` flag is gone. The Token Usage report
   gains a **By Session** breakdown alongside **By Agent**.

2. **Live status badge.** The card badge stopped guessing Running/idle from
   PTY output (an Ink TUI repaints on a timer, so "has the PTY gone quiet"
   flickers once a second). A new `HookService` writes a tiny node hook
   script + a settings JSON into userData; every Claude agent launches with
   `claude --settings <that file>`, and the hooks report `working` /
   `waiting` per session. The main process tails those files and forwards
   `agent:activity` to the renderer, which resolves the badge to
   **Running / Waiting / Done / Error**. Codex has no hooks, so it sits at
   Waiting while running.

Also bundled: a notification sound on `Stop` / `SubagentStop`
(`.claude/hooks/play-notification.js` + `assets/notification.mp3`) with a
🔔/🔇 mute toggle in the agent view that drops a `.notification-muted`
marker per project; and the screenshot save path moves from
`<project>/.ace/screenshots/` to `<project>/assets/images/screenshots/`.

---

## Reason

`label` was doing two jobs — a persistent handle and a per-task title — and
the auto-title feature (TICKET-0070) kept fighting itself on restore. Splitting
the two lets a restored session keep its real title without a `title_set`
flag, and lets the Token report group by either.

The old PTY-heuristic status badge was wrong most of the time for Claude's
TUI. Claude Code emits lifecycle hooks for exactly this; using them removes
the guesswork without touching any project or global Claude config.

---

## Implementation Plan

* [x] `DBService`: rename `label` → `agent_name` + add `session_title` on
      `agents` and `agent_sessions`; migrate existing rows (rebuild `agents`
      to drop the NOT NULL `label` and `title_set`); replace
      `updateAgentLabel` with `updateAgentSessionTitle` (updates both tables);
      add `getAgentIdBySession` for the hook watcher.
* [x] IPC + preload: `agents:updateLabel` → `agents:updateSessionTitle`;
      `agents:restore` / `agents:launch` / `recordAgentSession` payloads carry
      `agent_name` + `session_title`; `tokens:getProjectHistory` returns
      `agentName` + `sessionTitle`.
* [x] `HookService`: `ensureHookFiles()` (script + settings JSON in userData)
      and `watchAgentStatus()` (tail per-session status files → `agent:activity`).
      Wire into `registerHandlers`; expose `hooks:settingsPath`.
* [x] `agentLaunch.buildLaunchCommand`: inject `--settings <path>` for Claude.
* [x] `AgentTerminal`: `onStatusChange` prop, fetch the hook settings path at
      launch, use `session_title` for auto-title, show `agent_name` in the
      launch banner.
* [x] `AgentView` (`AgentPane`): subscribe to `agent:activity`; resolve the
      badge Stopped/Error/Done/Running/Waiting; show `agent_name` as a chip
      and `session_title` beside it; 🔔/🔇 mute toggle.
* [x] `TokenView`: **By Session** tab + `SessionCostTable`.
* [x] `useStore`: `updateAgentSessionTitle`, `soundsMuted` state + toggle.
* [x] `App`: map `label` → `agentName` in the `agents:status` running payload.
* [x] `settings:set` writes/removes a `.notification-muted` marker per project
      for `notification_sounds_muted`.
* [x] `ScreenshotService`: save under `assets/images/screenshots/`.
* [x] Tailwind `info` colour + `.badge-blue`; `.badge` gets `whitespace-nowrap
      shrink-0`.
* [x] `.gitignore`: `hook-execution.log`, `.claude/.notification-muted`.

---

## Files Modified

- `src/main/services/DBService.js`
- `src/main/services/HookService.js` (new)
- `src/main/services/ScreenshotService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/AgentTerminal.jsx`
- `src/renderer/views/AgentView.jsx`
- `src/renderer/views/TokenView.jsx`
- `src/renderer/store/useStore.js`
- `src/renderer/utils/agentLaunch.js`
- `src/renderer/App.jsx`
- `src/renderer/styles/globals.css`, `src/tailwind.config.js`
- `.claude/hooks/` (new), `.claude/settings.json` (new),
  `assets/notification.mp3` (new)
- `.gitignore`

---

## Testing

- `npm test` from `src/` — 65 pass, 1 skipped (Windows POSIX bit)
- `npm run build` from `src/` — renderer + main build clean
- Manual (pending): launch a Claude agent, confirm the badge tracks
  Running↔Waiting from real hook events and shows Done on exit; rename via
  first line still titles the card; Token Usage → By Session lists titles;
  🔔/🔇 toggles the completion sound.

---

## Result

Implemented and committed; awaiting the live manual check above.

---

## Notes

Committing `.claude/settings.json` makes the completion-sound hook active for
anyone working in this repo with Claude Code. `HookService`'s status hooks are
separate — generated per-run into userData, no repo config touched.

`play-notification.js` looks for its mute marker at
`.claude/hooks/.notification-muted` while `settings:set` writes it at
`.claude/.notification-muted` — the toggle won't actually mute until those
agree. Follow-up.

---

## Closed

YYYY-MM-DD
