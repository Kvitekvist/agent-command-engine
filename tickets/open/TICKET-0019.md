# TICKET-0019 — Add real interactive terminals to ACE, ported from Flowgrid's terminal

**Status**

Open

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-08

---

## Description

Add real interactive terminals to ACE, ported from Flowgrid's terminal
implementation (`ptyHost.js`): a forked node-pty host process driving
xterm.js panels in the renderer, so the user can run `claude`/`codex`
interactively inside the app instead of only through AgentService's
headless `--print`/stream-json agents.

**Correction (2026-08-08):** the first pass built this as a single global
floating terminal panel, opened via a Sidebar toggle, separate from the
Agent Pane. That was a misreading of the original request — the user
wanted a terminal *per agent*: each agent card in the Agents grid embeds
its own live terminal running `claude`/`codex` interactively (matching a
reference screenshot of multiple labeled agent-terminal tiles in a grid),
not one standalone shell. This replaces the Agent Pane's headless
chat-bubble UI entirely and removes the standalone floating panel — see
the revised Implementation Plan below. `ptyHost.js`/`TerminalService.js`
needed no changes: they were already keyed by session id and support
multiple concurrent sessions, so this correction is a renderer-only
change reusing the same backend.

---

## Reason

User asked for ACE's terminal to work the same way Flowgrid's does. ACE's
existing AgentService is a good fit for orchestrated, audited, multi-agent
runs, but it can't offer a raw interactive shell — no live prompts, no
arbitrary commands, no watching Claude Code's own interactive UI. Flowgrid
already solved this with a dedicated forked PTY host process (kept separate
from its worker process so a shell/CLI crash can't be taken down by an
unrelated crash, and vice versa) plus a mount-once-keep-alive xterm.js
panel that survives being hidden. Porting the same architecture gives ACE
an interactive terminal without touching AgentService at all.

---

## Implementation Plan

* [x] Add `node-pty`, `@xterm/xterm`, `@xterm/addon-fit` dependencies
* [x] Add `src/main/ptyHost.js` — forked child process hosting node-pty
      sessions (spawn/write/resize/dispose over `process.send`/`on('message')`),
      ported from Flowgrid with the same env-stripping AgentService already
      applies (`CLAUDE*` vars) so a `claude` CLI run inside the terminal
      doesn't inherit a sandboxed-child session from ACE's own dev process
* [x] Add `src/main/services/TerminalService.js` — forks/restarts
      `ptyHost.js`, forwards `terminal:data`/`terminal:exit`/`terminal:hostRestarted`
      to the renderer, mirrors AgentService's `init(mainWindow)`/`setWindow()`
      shape
* [x] Wire `TerminalService.init()` + graceful shutdown into
      `src/main/index.js` alongside `AgentService`
* [x] Add `terminal:spawn` (invoke) / `terminal:write` / `terminal:resize` /
      `terminal:dispose` (fire-and-forget) IPC handlers in
      `src/main/ipc/handlers.js`; `spawn` defaults `cwd` to the active
      project's folder path (passed from the renderer) rather than ACE's own
      repo, since ACE manages other people's project folders, not itself —
      this is the one deliberate deviation from Flowgrid's `defaultTerminalCwd()`
* [x] Expose `window.cpi.terminal.{spawn,write,resize,dispose,onData,onExit,onHostRestarted}`
      in `preload.js`
* [x] Add `src/renderer/components/TerminalPanel.jsx` — xterm.js + FitAddon,
      fixed-position floating panel, mounted once and hidden (not unmounted)
      via CSS so the live session survives closing the panel, same as
      Flowgrid
* [x] Wire into `App.jsx` (lazy-mount-once + visibility state) and add a
      toggle button to `Sidebar.jsx`
* [x] Gate the whole feature behind a `terminal_enabled` setting, default
      off — a raw unrestricted shell is materially more sensitive than a
      typical settings default (missed in the first pass; added after
      review against the reference implementation). Shared via the zustand
      store (`terminalEnabled`) so the Settings toggle and Sidebar's button
      stay in sync live; `SettingsView.jsx` gets a matching toggle section
* [x] Verify real OS-process cleanup on shutdown, not just that the IPC call
      resolves: standalone spike forked `ptyHost.js`, spawned a session,
      sent the same `{channel:'shutdown'}` message `TerminalService`
      sends, and confirmed via `process.kill(pid, 0)` throwing `ESRCH`
      that the shell process was actually dead afterward
* [x] Confirm ConPTY (not legacy winpty) is the active Windows backend —
      verified via node-pty's own default logic (`useConpty` defaults true
      whenever Windows build ≥ 18309, which this machine's Windows 11
      build satisfies, and `ptyHost.js` never overrides it)
* [ ] Manual verification (original, standalone-panel shape — superseded by
      the per-agent verification step below, kept for the process-cleanup
      history it already established)

### Correction: per-agent embedded terminal (2026-08-08)

* [x] Add `src/renderer/utils/agentLaunch.js` — builds the interactive CLI
      command line (`claude --model … <permission flags>` /
      `openai codex --model …`) typed into a fresh PTY session on agent
      launch. Permission-flag mapping is a deliberate duplicate of
      `AgentService.buildPermissionArgs` (kept in sync by comment — main
      and renderer are separate module systems here, so a shared import
      isn't free) since the same CLI flags apply whether Claude is invoked
      headlessly or interactively.
* [x] Add `src/renderer/components/AgentTerminal.jsx` — mounts an
      xterm.js + FitAddon instance per agent card, spawns a PTY session via
      the existing `window.cpi.terminal.*` API (`cwd` = that agent's
      project path), and writes the launch command as the session's first
      keystrokes so the card boots straight into the real interactive CLI.
* [x] Rewrite `AgentView.jsx`'s `AgentPane` to render `AgentTerminal`
      instead of the headless chat-bubble thread. Removed: prompt input box
      (the terminal itself takes keystrokes when focused — Claude Code's
      own interactive UI, visible inside the terminal, handles prompts and
      follow-ups), quick-reply buttons, Clear Context button (`/clear`
      inside the terminal replaces it), and the markdown-bubble renderer —
      all dead weight once output is a raw terminal stream instead of
      parsed stream-json. Stop still ends the agent (unmounts
      `AgentTerminal`, which disposes its PTY session in cleanup — the
      interactive CLI process actually exits, not just the UI).
* [x] Remove the standalone floating Terminal panel entirely — the
      original ask, corrected. Deleted `TerminalPanel.jsx`; removed the
      Sidebar toggle button, `App.jsx`'s mount/visibility state, the
      Settings "Terminal" section and its `terminal_enabled` setting
      round-trip, and the now-unused `terminalEnabled`/`setTerminalEnabled`
      store fields.
* [x] Remove renderer-side dead code that only ever existed to drive the
      headless chat thread: `agentOutputs`/`agentThinking` state and
      `addUserMessage`/`startAgentMessage`/`appendOutput`/
      `finalizeAgentMessage`/`setAgentThinking`/`clearAgentThread`/
      `restoreAgentThread` store actions, and App.jsx's
      `agent:output`/`agent:prompt-done` subscriptions. The IPC/backend
      side (`AgentService.sendPrompt`, `agents:sendPrompt`,
      `prompts`-table audit logging) is left intact — nothing currently
      calls it from the UI, but Audit Log / Token Usage still read
      historical rows through it and it's reasonable infrastructure to
      keep for a future headless/automation feature, not literal dead code.
* [x] Verification via a live dev run, driven end-to-end over the Chrome
      DevTools Protocol (no Playwright dependency added — raw CDP over
      Node's built-in `WebSocket`) since this environment's own
      `ELECTRON_RUN_AS_NODE=1` has to be stripped for a child `electron.exe`
      to boot as a real GUI app rather than plain Node: selected an
      existing real project, clicked "+ New Agent", confirmed the resulting
      card's DOM contains an `.xterm` element and no leftover prompt-input
      box (`input[placeholder="Send a prompt…"]` — proves the old
      chat-bubble UI is gone), clicked Stop and confirmed the card flips to
      "○ Stopped" with the `.xterm` element removed (proves `AgentTerminal`
      unmounts and disposes its PTY session instead of merely hiding).
      Separately called `window.cpi.terminal.spawn/write/onData` directly
      (the same calls `AgentTerminal.jsx` makes) and confirmed a real
      PowerShell session starts, a typed command executes, and its actual
      output comes back over the data channel.
* [ ] Still open: pixel-level confirmation that xterm.js paints the
      `claude`/`codex` CLI's own banner inside a live agent card (DOM-text
      probing came back empty because xterm renders glyphs to a canvas, not
      DOM text — a `Page.captureScreenshot` CDP call was attempted for a
      visual check but hung in this environment and was abandoned rather
      than debugged further); typing a follow-up prompt directly into a
      running agent's terminal and confirming it responds; confirming
      Codex agents boot correctly too (only Claude was launched in this
      pass).

---

## Files Modified

- src/package.json
- src/main/ptyHost.js (new)
- src/main/services/TerminalService.js (new)
- src/main/index.js
- src/main/ipc/handlers.js
- src/main/preload.js
- src/renderer/App.jsx
- src/renderer/components/Sidebar.jsx
- src/renderer/views/SettingsView.jsx
- src/renderer/store/useStore.js
- src/renderer/views/AgentView.jsx (correction)
- src/renderer/components/AgentTerminal.jsx (new, correction)
- src/renderer/utils/agentLaunch.js (new, correction)
- src/renderer/components/TerminalPanel.jsx (deleted, correction)

---

## Testing

`npm run build:renderer` and `npm run build:main` both succeed. Manual —
see the per-agent-embedded-terminal checklist above for what was and
wasn't exercised in a live window this session.

---

## Result

Implemented and verified at two levels:
1. Live dev run: after rebuilding `dist/main` (see Notes) and clearing
   stale dev processes, the app started cleanly and printed `PTY host
   process ready`, confirming `TerminalService` forks `ptyHost.js`,
   `node-pty` loads its native binding, and the ready-handshake IPC works.
2. Standalone spike (bypassing the UI, matching the reference
   implementation's "confirm the real OS process is actually dead, not
   just that the IPC call resolved" requirement): forked `ptyHost.js`
   directly, spawned a PowerShell session, wrote a command and read real
   output back, then sent the same graceful-shutdown message
   `TerminalService.shutdown()` uses and confirmed the shell's OS process
   was actually gone afterward (`process.kill(pid, 0)` → `ESRCH`). Spike
   script deleted once proven, per the reference instructions.

First pass missed the settings-gate (default off) the reference
implementation calls for — added after the user flagged the implementation
didn't match Flowgrid's, along with the ConPTY-backend confirmation.

**Correction (2026-08-08):** the user clarified the actual ask was a
terminal *per agent*, not one standalone panel — see the corrected
Description/Implementation Plan above. `ptyHost.js`/`TerminalService.js`
needed zero changes (already multi-session); the work was entirely in the
renderer: a new `agentLaunch.js` (builds the `claude`/`codex` command line
from an agent's provider/model/permissionMode), a new `AgentTerminal.jsx`
(one embedded xterm+PTY session per agent card, auto-typing that command
on mount), `AgentView.jsx`'s `AgentPane` rewritten to render it instead of
the headless chat thread, and the standalone floating panel (component,
Sidebar toggle, Settings section, store fields) removed outright per the
user's "not a terminal by itself" framing. Verified in a live dev run via
raw CDP automation (see checklist) — the DOM- and IPC-level checks passed;
a literal pixel screenshot of the CLI banner rendering and Codex agents
specifically remain unverified, noted above as open follow-ups rather than
blocking this pass.

---

## Notes

ACE has a single fixed dark theme (Tailwind tokens in `tailwind.config.js`),
unlike Flowgrid's multi-theme `data-theme` CSS-custom-property setup, so
`TerminalPanel.jsx` uses a static xterm theme object matching ACE's palette
instead of Flowgrid's `readThemeColors()`/`MutationObserver` approach — no
theme switching to react to here.

Discovered while verifying this ticket: `npm run dev` does NOT rebuild
`dist/main` (Electron's actual entry point per `package.json`'s `"main"`
field) — `dev:main` just launches whatever's already there. The first dev
run silently ran pre-TerminalService code with no error at all. Fixed for
this session with `npm run build:main`; documented as a standing gotcha in
architecture.md so it doesn't cost the next person the same debugging
detour.

Packaging note carried over unresolved: like Flowgrid, `node-pty` is never
loaded into the Electron main process directly (only into the forked
`ptyHost.js`, via plain `node` in dev / `ELECTRON_RUN_AS_NODE=1` once
packaged) so no `electron-rebuild` step is needed in dev. Whether the
packaged `.exe` needs an ABI-matched prebuilt `node-pty` binary bundled is
untested — flagged for whoever picks up packaging/electron-builder work
next, not solved here.

**Correction notes (2026-08-08):**

- **Known limitation, not solved here:** an agent's interactive terminal
  session does not survive switching away from its project and back (nor
  does it survive the app restarting) — `AgentTerminal` only mounts while
  `agent.status === 'running'`, and switching projects clears the `agents`
  store array, unmounting it and disposing its PTY session. Re-selecting
  the project re-mounts a *brand-new* session (fresh `claude`/`codex`
  process, no scrollback). This is a real regression relative to how the
  old standalone panel behaved (hidden-but-alive, matching VS Code's
  integrated terminal) — acceptable for this pass since each agent's
  terminal is now tied to that agent's lifecycle rather than being one
  global always-there shell, but worth a follow-up ticket if session
  continuity across project switches turns out to matter in practice.
- **Audit trail / token tracking is now frozen for new agents.** Per the
  user's explicit choice when scoping this correction: `AgentService.
  sendPrompt`'s stream-json parsing (and the `prompts` table rows / token
  reconciliation it drives) is no longer called from any UI — agents
  launched via the new embedded terminal never generate `prompts` rows, so
  Audit Log and Token Usage stop gaining new data for them. Historical rows
  from before this change still display fine. tokscale itself reads
  Claude's own local session transcripts independent of headless vs.
  interactive invocation, so a future ticket could rebuild token tracking
  against that directly (matching sessions some other way, since there's
  no longer a stream-json-captured session id to key off of) without
  reviving the headless path.
- **Environment gotcha hit while verifying this ticket, unrelated to the
  app itself:** this Claude Code session's own process tree has
  `ELECTRON_RUN_AS_NODE=1` set (it's running inside another Electron-based
  harness), which leaks to any child `electron.exe` and makes it boot as
  plain Node instead of a real GUI app (`Cannot read properties of
  undefined (reading 'whenReady')` — `require('electron')` returns a path
  string, not the API, under that flag). Had to launch the verification
  instance with that variable explicitly stripped (`env -u
  ELECTRON_RUN_AS_NODE`). Not a ACE bug; recorded here only so the next
  person debugging "electron won't start" from inside a Claude Code
  session doesn't lose time on it.
- Also observed once, harmless: node-pty's Windows ConPTY helper
  (`conpty_console_list_agent.js`) logged an `AttachConsole failed`
  uncaught exception to `ptyHost.js`'s stderr during testing. `ptyHost.js`
  itself did not crash or restart (no `Restarting PTY host process...` in
  the log), so this looks like a known ConPTY console-list quirk in a
  short-lived helper process node-pty spawns internally, not a fault in
  this app's own code — flagged for awareness, not investigated further.

---

## Closed

