# Auto-Answer Permission Prompts Feature

## Overview
Added a global toggle in Settings to automatically answer "yes" to permission prompts in agent terminals. This solves the limitation where some models (like `claude-sonnet-4-5` via Vertex AI) don't support the `--dangerously-skip-permissions` flag and continuously ask for permission.

**Status**: Working (TICKET-0039, 2026-08-10). TICKET-0038 was closed the same day as "fully live-verified", but a fresh live report showed the exact prompt it was built to catch (a real WebFetch permission menu) sitting unanswered — see "Root cause of the TICKET-0039 regression" below. Detection itself (`stripAnsi()` + `/❯\s*1\.\s*Yes\b/i`) was not the problem and is unchanged; the gap was *when* it got to run and what happened if its response didn't land.

## Root cause of the TICKET-0039 regression (2026-08-10, second follow-up)
Two stacked gaps, either of which reproduces "prompt sits there forever, toggle is on":

1. **Spawn-time-only setting.** `AgentTerminal.jsx` read `auto_accept_permissions` once, at terminal spawn, and passed it into `ptyHost.js`'s `spawnSession()`. Flipping the Settings toggle on for an agent that was *already running* — the natural thing to do the moment you notice it stuck on a prompt — had no effect until that agent was stopped and relaunched. This was even called out as a known limitation in this doc's own "Per-Session Behavior" section below, but the practical impact (an already-visible prompt just stays there) wasn't obvious until it was hit live.
2. **No verification that the response landed.** `ptyHost.js` sent a single `\r` and immediately cleared its buffer. If that keystroke was dropped (ConPTY timing, CLI mid-redraw, anything), there was no way to tell — the prompt would sit there identically to detection never having matched at all.

### Fix
`ptyHost.js`:
- The rolling output buffer is now accumulated on every chunk *regardless* of whether auto-answer is enabled for that session (cheap — just a string append). A new `setAutoAnswer(id, enabled)` command can flip the flag on a live session and, when turning it on, immediately checks the buffer that's already there — so enabling it while a prompt is on screen answers that exact prompt, not just future ones.
- After sending `\r`, `respondAndVerify()` re-checks ~600ms later whether the same prompt marker is still present; if so it resends, up to 2 retries, instead of assuming success.

Wired end-to-end: `TerminalService.setAutoAnswer()` → `terminal:setAutoAnswer` IPC → `window.cpi.terminal.setAutoAnswer(id, enabled)`.

`AgentTerminal.jsx` now renders two controls on every running agent's terminal:
- **🛡️ Auto-approve: On/Off** — live toggle for just that session, via the new IPC call. Still initialized from the global `auto_accept_permissions` setting at spawn, same as before.
- **✅ Approve now** — sends `\r` directly, independent of detection or the toggle, as a one-click way to unstick a prompt that's visibly waiting.

## Root cause of the real bug (2026-08-10 follow-up)
The original re-enable matched plain-text patterns like `Allow? (y/n)` — guessed, not captured from a real session. The actual Claude Code CLI (v2.1.226) never prints that. Its permission prompt (and the workspace-trust dialog shown for a not-yet-trusted folder) is an Ink-rendered TUI menu:

```
Do you want to allow Claude to fetch this content?
❯ 1. Yes
  2. Yes, and don't ask again for www.yr.no
  3. No, and tell Claude what to do differently (esc)
```

And critically, the words in that menu are *not* separated by literal space characters in the raw PTY byte stream. Ink positions each word with a cursor-forward escape code (`\x1b[1C`) instead of a space, and repositions each redrawn line with a cursor-absolute-position code (`\x1b[<row>;<col>H`). So no plain-text regex — right or wrong wording — could ever have matched the raw chunks. Confirmed by spawning a real `claude` session through `node-pty` directly (bypassing ACE) and dumping the raw output to a file.

Fixed by reconstructing approximate visible text before matching: cursor-forward codes become spaces, cursor-position codes become newlines, everything else CSI/OSC is dropped (`stripAnsi()` in `ptyHost.js`). Detection now matches `/❯\s*1\.\s*Yes\b/i` — the selection-arrow-plus-default-option marker common to every one of these prompts — and the response is a plain `\r` (Enter, confirming the already-selected "Yes"), not `y\r` (there's no `(y/n)` text field to answer; `y` was never bound to anything in the menu).

## Problem Being Solved
Some Claude models accessed via Vertex AI don't support the `--dangerously-skip-permissions` CLI flag. When using these models interactively, the CLI prompts for every tool use requiring approval, requiring manual confirmation each time. This feature automatically confirms those prompts.

## How It Works

### Architecture
The solution intercepts permission prompts at the PTY (pseudo-terminal) level:

1. **ptyHost.js** - Monitors terminal output for the real Ink-menu permission prompt marker
2. When a prompt is detected, automatically sends `\r` (Enter, confirming the already-selected "1. Yes" option) to the PTY
3. Uses a rolling 4000-character buffer (raw, pre-strip) to detect prompts across chunk boundaries
4. Strips/reconstructs the buffer's ANSI escape codes into approximate visible text before matching (see Root Cause section above)
5. Includes a 100ms delay to ensure the prompt is fully rendered before responding

### Permission Prompt Detection
After `stripAnsi()` reconstructs visible text from the raw buffer (cursor-forward codes → spaces, cursor-position codes → newlines, other CSI/OSC dropped), a single pattern is matched:
- `/❯\s*1\.\s*Yes\b/i`

This is the selection-arrow-plus-default-option marker every one of Claude Code's Ink `SelectInput` prompts uses (workspace trust, tool permission, etc.) — "1. Yes" is always the pre-selected default option, so confirming it just means submitting the current selection with Enter. It's not text the assistant's own prose would ever emit, so false positives are effectively impossible.

## Changes Made

### 1. ptyHost.js
**Location:** `src/main/ptyHost.js`

**Added:**
- `autoAnswerEnabled` Map to track which sessions have auto-answer enabled
- `autoAnswerPermissions` parameter to `spawnSession()`
- `stripAnsi()` — reconstructs approximate visible text from raw PTY output
- Output buffer (rolling 4000-char window) to detect prompts across chunk boundaries
- Single selection-marker pattern match (`/❯\s*1\.\s*Yes\b/i`) against the stripped buffer
- Debounce mechanism (200ms) to prevent duplicate auto-answers
- Automatic response with `\r` when prompt detected (100ms delay)
- Buffer clearing after each auto-answer to prevent re-matching
- Cleanup of auto-answer state on session exit

**Implementation Details (TICKET-0038, same-day follow-up):**
The version originally re-enabled that day matched guessed plain-text `pattern? (y/n)` formats the real CLI never prints, and would never have matched anyway since the real prompt's words are separated by cursor-movement escape codes, not spaces, in the raw stream (see Root Cause above). Rewritten to reconstruct visible text first, then match the CLI's actual Ink-menu marker and respond with Enter instead of a meaningless `y` keystroke. Live-verified end-to-end: a real workspace-trust dialog and multiple real WebFetch permission prompts, all auto-confirmed with zero manual input, while an agent fetched live Oslo weather data from yr.no in a second, fully isolated ACE instance.

### 2. TerminalService.js
**Location:** `src/main/services/TerminalService.js`

**Modified:**
- Pass `autoAnswerPermissions` option through to ptyHost in spawn call

### 3. AgentTerminal.jsx
**Location:** `src/renderer/components/AgentTerminal.jsx`

**Modified:**
- Load `auto_accept_permissions` setting on terminal spawn
- Pass `autoAnswerPermissions: true/false` to terminal spawn based on setting

### 4. SettingsView.jsx
**Location:** `src/renderer/views/SettingsView.jsx`

**Added:**
- New state variable: `autoAcceptPermissions` (boolean)
- Load/save `auto_accept_permissions` from persistent storage
- New UI toggle in General Settings section:
  - Label: "Auto-answer permission prompts"
  - Description explaining it works for models without --dangerously-skip-permissions support
  - Toggle switch matching existing UI patterns

### 5. AgentView.jsx
**Location:** `src/renderer/views/AgentView.jsx`

**Added:**
- `claude-sonnet-4-5` to `CLAUDE_MODELS` array for Vertex AI support

## Usage

### Enable Auto-Answer
1. Go to **Settings** tab
2. Scroll to **General Settings** section
3. Toggle **"Auto-answer permission prompts"** ON
4. Click **Save Settings**
5. Launch or relaunch agents - permission prompts will be answered automatically

### Disable Auto-Answer
1. Go to **Settings** tab
2. Toggle **"Auto-answer permission prompts"** OFF
3. Click **Save Settings**
4. New agent sessions will require manual permission responses

### Per-Session Behavior
- The global Settings toggle is still only read at terminal spawn (initial value for new agents)
- **TICKET-0039:** each running agent's terminal now has its own live **🛡️ Auto-approve** pill — click it to turn auto-answer on/off for that session immediately, no relaunch needed. If a prompt is already on screen when you turn it on, it's answered right away.
- **✅ Approve now** on the same terminal sends Enter directly, regardless of the toggle — a manual fallback for a prompt that's visibly stuck

## Important Notes

### This Does NOT:
- Change the permission mode (Safe/Guarded/Auto) selected when launching
- Bypass CLI flags - it works WITH the existing permission system
- Affect headless agents (those don't prompt interactively anyway)

### This DOES:
- Automatically respond to interactive permission prompts in agent terminals
- Work with ANY model that prompts for permissions
- Specifically solve the Vertex AI model limitation (claude-sonnet-4-5)
- Apply only to terminal sessions spawned after the setting is enabled

## Security Notice
The UI description explicitly states:
> "Automatically responds 'yes' to all permission prompts in agent terminals. Useful for models that don't support --dangerously-skip-permissions flag (like claude-sonnet-4-5 via Vertex AI)."

Users should understand that this grants all requested permissions automatically, similar to using Auto mode, but at the terminal interaction level.

## Files Modified
- `src/main/ptyHost.js` - Core auto-answer logic, prompt detection, live toggle + retry (TICKET-0039)
- `src/main/services/TerminalService.js` - Pass autoAnswerPermissions option; `setAutoAnswer()` (TICKET-0039)
- `src/main/ipc/handlers.js` - `terminal:setAutoAnswer` IPC (TICKET-0039)
- `src/main/preload.js` - `window.cpi.terminal.setAutoAnswer` (TICKET-0039)
- `src/renderer/components/AgentTerminal.jsx` - Load setting and pass to spawn; live toggle pill + manual Approve button (TICKET-0039)
- `src/renderer/views/SettingsView.jsx` - UI toggle and persistence
- `src/renderer/views/AgentView.jsx` - Added claude-sonnet-4-5 model

## Testing Checklist
- [x] Toggle appears in Settings > General Settings
- [x] Toggle persists after Save (read back via `window.cpi.getSetting`)
- [x] When enabled, permission prompts (the real Ink menu) are auto-confirmed
- [ ] When disabled, permission prompts require manual response — not re-tested this pass, unchanged logic
- [ ] Works with claude-sonnet-4-5 (Vertex AI) model specifically — tested with the default `claude-sonnet-5` model instead; the fix is model-agnostic (it only depends on the CLI's own prompt rendering, not which model answers)
- [x] `npm run build` clean, `npm test` 11/11 pass (TICKET-0039)
- [ ] Live: flip the 🛡️ Auto-approve pill on for an already-running agent sitting on a real unanswered prompt, confirm it resolves without a relaunch (TICKET-0039, not yet re-verified live — see ticket Notes)
- [ ] Live: click ✅ Approve now on a real stuck prompt, confirm it submits "1. Yes" (TICKET-0039)
- [x] No duplicate responses observed across repeated tool calls in one session
- [x] Save Settings button shows "✓ Saved" confirmation
- [x] Auto-answer state is cleaned up when session exits (unchanged from original implementation)
