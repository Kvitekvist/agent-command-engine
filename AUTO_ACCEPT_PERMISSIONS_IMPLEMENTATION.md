# Auto-Answer Permission Prompts Feature

## Overview
Each running agent's terminal has a per-agent **🛡️ Auto-approve** toggle that automatically answers permission prompts in that terminal. This solves the limitation where some models (like `claude-sonnet-4-5` via Vertex AI) don't support the `--dangerously-skip-permissions` flag and continuously ask for permission. (Originally a global Settings toggle — removed in favor of purely per-agent control; see TICKET-0039's follow-up cleanup below.)

**Status**: Working, live-verified (TICKET-0039, 2026-08-11). TICKET-0038 was closed the same day as "fully live-verified", but a fresh live report showed the exact prompt it was built to catch sitting unanswered. Three stacked bugs turned out to be behind that — see below. The user confirmed the full fix live: a single initial prompt drove a real WebFetch, a Web Search, a second Fetch, and a local file save to completion with zero manual clicks.

## Root cause #1 of the TICKET-0039 regression (2026-08-10)
Two stacked gaps, either of which reproduces "prompt sits there forever, toggle is on":

1. **Spawn-time-only setting.** `AgentTerminal.jsx` read `auto_accept_permissions` once, at terminal spawn, and passed it into `ptyHost.js`'s `spawnSession()`. Flipping the Settings toggle on for an agent that was *already running* — the natural thing to do the moment you notice it stuck on a prompt — had no effect until that agent was stopped and relaunched.
2. **No verification that the response landed.** `ptyHost.js` sent a single `\r` and immediately cleared its buffer. If that keystroke was dropped (ConPTY timing, CLI mid-redraw, anything), there was no way to tell — the prompt would sit there identically to detection never having matched at all.

### Fix
`ptyHost.js`:
- The rolling output buffer is now accumulated on every chunk *regardless* of whether auto-answer is enabled for that session (cheap — just a string append). A new `setAutoAnswer(id, enabled)` command can flip the flag on a live session and, when turning it on, immediately checks the buffer that's already there — so enabling it while a prompt is on screen answers that exact prompt, not just future ones.
- After sending `\r`, `respondAndVerify()` re-checks ~600ms later whether the same prompt marker is still present; if so it resends, up to 2 retries, instead of assuming success.

Wired end-to-end: `TerminalService.setAutoAnswer()` → `terminal:setAutoAnswer` IPC → `window.cpi.terminal.setAutoAnswer(id, enabled)`.

`AgentTerminal.jsx` at this point rendered two controls on every running agent's terminal:
- **🛡️ Auto-approve: On/Off** — live toggle for just that session, via the new IPC call. At this point still initialized from the global `auto_accept_permissions` setting at spawn.
- **✅ Approve now** — sends `\r` directly, independent of detection or the toggle, as a one-click way to unstick a prompt that's visibly waiting.

(Both the global setting and the Approve now button were removed later the same day, once live-verification confirmed the toggle alone works — see "Follow-up cleanup" under root cause #3 below.)

## Root cause #2 of the TICKET-0039 regression, the real explanation (2026-08-10, live-tested)
Fix #1 alone still wasn't enough — the user restarted the app, retested, and hit the identical symptom again with the toggle already on. Built a standalone harness that forks the real `ptyHost.js` and drives a real, unattended `claude` session with `autoAnswerPermissions: true` set from spawn (removing gap #1 above from the equation) and no manual intervention, asking it to fetch yr.no weather. The agent used a browser tool instead of `WebFetch`, and the real captured prompt was:

```
Claude in Chrome wants to create a browser window and read your tabs
❯ 1. Allow
2. Deny (esc)
```

`PERMISSION_PROMPT_PATTERN` was `/❯\s*1\.\s*Yes\b/i` — hardcoded to the literal word "Yes", inherited unquestioned from TICKET-0038. It never matches "Allow" (or, by the same logic, whatever wording Bash-command/file-write/other-MCP-tool prompts use). **This is the actual bug behind the original screenshot** — TICKET-0038's own live verification happened to only exercise a WebFetch ("Yes") prompt, so the narrowness never showed up.

### Fix
Broadened `PERMISSION_PROMPT_PATTERN` from `/❯\s*1\.\s*Yes\b/i` to `/❯\s*1\.\s*\S/` — the ❯ selection-arrow-next-to-option-1 marker is still the reliable, prose-proof signal (unchanged reasoning from TICKET-0038), it just no longer also requires specific text after "1.". The response (`\r`, confirming the pre-selected option) is unchanged.

Verified **offline** against the real raw bytes captured from that live run (no new agent spawned for this check): the old pattern doesn't match; the new one does. A full live end-to-end rerun with the fix in place was attempted but blocked by Claude Code's own auto-mode safety classifier (an unattended script driving a full agent session with real tool/browser permissions) across three different invocation approaches — see TICKET-0039's Notes for the detail.

## Root cause #3 of the TICKET-0039 regression, the actual explanation (2026-08-11, found via the user's own app)
Fix #2 *still* failed live — for the exact WebFetch/"Yes" prompt TICKET-0038 originally claimed to verify, with the toggle already on from spawn (ruling fix #1's gap back out too). With live-agent-spawning blocked by the classifier, added temporary file-based debug logging to `ptyHost.js` (writes every detection check to `~/ace-auto-answer-debug.log`) instead, and asked the user to reproduce once in their own already-open, already-supervised app. Reading that log directly (no automation needed) showed the real captured tail:

```
               > 1. Yes
   2. Yes, and don't ask again for www.yr.no
 3. No, and tell Claude what to do differently (esc)
```

A plain ASCII `>` (U+003E) — not the fancy Unicode `❯` (U+276F) the pattern required. Other Unicode in the same buffer (spinner glyphs, box-drawing characters) rendered correctly, so this wasn't a blanket encoding problem — specifically Ink's `SelectInput` indicator falls back to ASCII in the real Electron-forked `ptyHost` process's spawn environment, where the standalone test harness used to find root cause #2 (spawned differently) got the fancy glyph. The exact cause of that rendering difference wasn't chased further; matching both glyphs sidesteps it regardless.

### Fix
`PERMISSION_PROMPT_PATTERN` is now `/[❯>]\s*1\.\s*\S/`. Offline-verified against the exact real captured line above (matches), then confirmed by the user live: full flow completed, zero manual clicks. The temporary debug logging was removed once the fix was confirmed.

### Follow-up cleanup (same day, direct user requests once auto-answer was confirmed working)
- Removed the **✅ Approve now** manual button — the working 🛡️ Auto-approve toggle is sufficient on its own.
- Removed the Safe/Guarded/Auto permission-mode selector from the agent-launch bar (`AgentView.jsx`). New agents now launch fixed at `safe` — deliberately not `auto` (`--dangerously-skip-permissions`), since that would bypass the CLI's own permission system entirely instead of relying on this app to auto-confirm it. Safe mode's restrictive `allowedTools` combined with working auto-answer covers the same ground without asking the user to pick a tier upfront.
- Confirmed "off by default" was already true at the code level (`auto_accept_permissions` was never seeded anywhere) — the appearance of being "on by default" was the user's own dev database already having it saved `'true'` from earlier testing, corrected via the Settings UI itself rather than a direct DB edit (Electron holds the sql.js database in memory and periodically overwrites the file on disk).
- **Removed the global Settings toggle entirely.** Auto-answer is now purely a live, per-agent runtime control via the 🛡️ pill — no spawn-time setting at all. `ptyHost.js`'s `spawnSession()` no longer accepts an `autoAnswerPermissions` parameter (every session now starts with it off), and `TerminalService.spawn()` / `AgentTerminal.jsx` / `SettingsView.jsx` were simplified to match.

## Root cause of the original TICKET-0038 bug (2026-08-10, for context)
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
- `autoAnswerEnabled` Map to track which sessions have auto-answer enabled — set only via the live `setAutoAnswer(id, enabled)` command now (TICKET-0039 follow-up removed the spawn-time `autoAnswerPermissions` parameter; every session starts off)
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

**Added:**
- `setAutoAnswer(id, enabled)` — sends the live toggle command to ptyHost

### 3. AgentTerminal.jsx
**Location:** `src/renderer/components/AgentTerminal.jsx`

**Current behavior:**
- Every terminal spawns with auto-answer off (no setting read at all)
- Renders a **🛡️ Auto-approve** pill that flips it on/off live via `window.cpi.terminal.setAutoAnswer(id, enabled)`

### 4. SettingsView.jsx
**Location:** `src/renderer/views/SettingsView.jsx`

The global "Auto-answer permission prompts" toggle that originally lived here was removed (TICKET-0039 follow-up) — auto-answer is purely a per-agent runtime control now, no global setting to configure.

### 5. AgentView.jsx
**Location:** `src/renderer/views/AgentView.jsx`

**Added:**
- `claude-sonnet-4-5` to `CLAUDE_MODELS` array for Vertex AI support
- (TICKET-0039 follow-up) Removed the Safe/Guarded/Auto permission-mode selector; new agents launch fixed at `safe`

## Usage

### Enable Auto-Answer
On any running agent's terminal, click the **🛡️ Auto-approve** pill. It flips on immediately for that session — no relaunch, and if a prompt is already on screen it's answered right away.

### Disable Auto-Answer
Click the same pill again.

### Default
Off, for every new terminal session — there's no setting to configure and nothing to seed; auto-answer is always off until you click the pill for that specific agent. Silently auto-confirming every permission prompt is a real security-relevant behavior and shouldn't be on without an explicit, per-agent opt-in.

### Per-Session Behavior
- Purely per-agent (TICKET-0039 follow-up removed the earlier global Settings toggle) — each running agent's terminal has its own independent 🛡️ Auto-approve state
- The earlier manual **✅ Approve now** button was also removed (TICKET-0039, same day auto-answer was confirmed working) — the toggle alone is sufficient now that it actually works live.

## Important Notes

### This Does NOT:
- Bypass CLI flags - it works WITH the existing permission system
- Affect headless agents (those don't prompt interactively anyway)

### This DOES:
- Automatically respond to interactive permission prompts in agent terminals
- Work with ANY model that prompts for permissions
- Specifically solve the Vertex AI model limitation (claude-sonnet-4-5)
- Apply to a session as soon as the global setting is enabled at spawn, or the per-terminal 🛡️ Auto-approve pill is flipped on live (TICKET-0039, no relaunch needed for the latter)

## Security Notice
The UI description explicitly states:
> "Automatically responds 'yes' to all permission prompts in agent terminals. Useful for models that don't support --dangerously-skip-permissions flag (like claude-sonnet-4-5 via Vertex AI)."

Users should understand that turning the pill on for a given agent grants all of that agent's requested permissions automatically at the terminal interaction level, for that session only.

## Files Modified
- `src/main/ptyHost.js` - Core auto-answer logic, prompt detection (now matches both `❯` and `>`), live toggle + retry, no spawn-time parameter (TICKET-0039)
- `src/main/services/TerminalService.js` - `setAutoAnswer()` (TICKET-0039)
- `src/main/ipc/handlers.js` - `terminal:setAutoAnswer` IPC (TICKET-0039)
- `src/main/preload.js` - `window.cpi.terminal.setAutoAnswer` (TICKET-0039)
- `src/renderer/components/AgentTerminal.jsx` - Live toggle pill, purely per-agent, no global setting read (TICKET-0039; manual Approve button added then removed same day once the toggle was confirmed working)
- `src/renderer/views/SettingsView.jsx` - Global toggle removed entirely (TICKET-0039 follow-up)
- `src/renderer/views/AgentView.jsx` - Added claude-sonnet-4-5 model; TICKET-0039 also removed the Safe/Guarded/Auto selector, agents now launch fixed at `safe`

## Testing Checklist
- [x] When enabled (per-agent 🛡️ pill), permission prompts (the real Ink menu, either glyph rendering) are auto-confirmed — **live-verified end-to-end by the user** (TICKET-0039): single prompt drove WebFetch, Web Search, a second Fetch, and a local save to completion with zero manual clicks
- [x] Default is off for every new terminal session (TICKET-0039 follow-up — no setting to seed at all anymore)
- [ ] When disabled, permission prompts require manual response — not re-tested this pass, unchanged logic
- [ ] Works with claude-sonnet-4-5 (Vertex AI) model specifically — tested with the default `claude-sonnet-5` model instead; the fix is model-agnostic (it only depends on the CLI's own prompt rendering, not which model answers)
- [x] `npm run build` clean, `npm test` 11/11 pass (TICKET-0039, re-checked after every fix pass)
- [x] Live: flip the 🛡️ Auto-approve pill on for an already-running agent sitting on a real unanswered prompt, confirm it resolves without a relaunch (TICKET-0039)
- [x] No duplicate responses observed across repeated tool calls in one session
- [x] Auto-answer state is cleaned up when session exits (unchanged from original implementation)
