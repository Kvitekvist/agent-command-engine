# Auto-Answer Permission Prompts Feature

## Overview
Added a global toggle in Settings to automatically answer "yes" to permission prompts in agent terminals. This solves the limitation where some models (like `claude-sonnet-4-5` via Vertex AI) don't support the `--dangerously-skip-permissions` flag and continuously ask for permission.

**Status**: Re-enabled in TICKET-0038 (2026-08-10) with improved implementation that includes debouncing and better pattern matching to prevent interference with normal terminal input.

## Problem Being Solved
Some Claude models accessed via Vertex AI don't support the `--dangerously-skip-permissions` CLI flag. When using these models interactively, the CLI prompts "Allow? (y/n)" for every tool use, requiring manual confirmation each time. This feature automatically responds "y" to these prompts.

## How It Works

### Architecture
The solution intercepts permission prompts at the PTY (pseudo-terminal) level:

1. **ptyHost.js** - Monitors terminal output for permission prompt patterns
2. When a prompt is detected, automatically sends `y\r` (yes + enter) to the PTY
3. Uses a rolling 500-character buffer to detect prompts across chunk boundaries
4. Includes a 50ms delay to ensure the prompt is fully rendered before responding

### Permission Prompt Detection
Detects common Claude CLI permission prompt patterns:
- `Allow? (y/n)`
- `Proceed? (y/n)`
- `Continue? (y/n)`
- `Approve? (y/n)`
- `Grant permission? (y/n)`

All patterns are case-insensitive and detect the exact format with parentheses.

## Changes Made

### 1. ptyHost.js
**Location:** `src/main/ptyHost.js`

**Added:**
- `autoAnswerEnabled` Map to track which sessions have auto-answer enabled
- `autoAnswerPermissions` parameter to `spawnSession()`
- Output buffer (rolling 500-char window) to detect permission prompts
- Pattern matching against common permission prompt formats (case-insensitive regex)
- Debounce mechanism (200ms) to prevent duplicate auto-answers
- Automatic response with `y\r` when prompt detected (50ms delay)
- Buffer clearing after each auto-answer to prevent re-matching
- Cleanup of auto-answer state on session exit

**Implementation Details (TICKET-0038):**
The auto-answer logic was initially implemented but then disabled due to concerns about spacebar interference. The re-enabled version includes:
- More specific pattern matching using regex with exact format `pattern? (y/n)`
- 200ms debounce between auto-answers
- Buffer clear after each response
- 50ms delay before sending response to ensure prompt is fully rendered

This robust implementation prevents interference with normal terminal input while reliably catching permission prompts.

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
- The setting is applied when the terminal session is spawned
- Changing the setting doesn't affect already-running agents
- Stop and relaunch the agent to apply the new setting

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
- `src/main/ptyHost.js` - Core auto-answer logic and prompt detection
- `src/main/services/TerminalService.js` - Pass autoAnswerPermissions option
- `src/renderer/components/AgentTerminal.jsx` - Load setting and pass to spawn
- `src/renderer/views/SettingsView.jsx` - UI toggle and persistence
- `src/renderer/views/AgentView.jsx` - Added claude-sonnet-4-5 model

## Testing Checklist
- [ ] Toggle appears in Settings > General Settings
- [ ] Toggle state persists after app restart
- [ ] When enabled, permission prompts are auto-answered with "y"
- [ ] When disabled, permission prompts require manual response
- [ ] Works with claude-sonnet-4-5 (Vertex AI) model
- [ ] No duplicate responses (buffer clears after each auto-answer)
- [ ] Save Settings button shows "✓ Saved" confirmation
- [ ] Auto-answer state is cleaned up when session exits
