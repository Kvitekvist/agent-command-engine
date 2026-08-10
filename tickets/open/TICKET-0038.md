# TICKET-0038

**Status**

Open

**Type**

Feature

**Priority**

High

**Created**

2026-08-10

---

## Description

Re-enable the auto-accept permissions feature that was previously implemented but disabled in ptyHost.js. The UI toggle exists in Settings, the code is wired through the entire chain (SettingsView → AgentTerminal → TerminalService → ptyHost), but the actual permission-detection logic was commented out with "TEMPORARILY DISABLED - Testing if auto-answer causes spacebar issue".

---

## Reason

User needs this as a workaround for models that don't support the `--dangerously-skip-permissions` flag (like `claude-sonnet-4-5` via Vertex AI). When these models run interactively, the CLI prompts "Allow? (y/n)" for every tool use, requiring manual confirmation each time. This feature automatically responds "y" to these prompts.

The previous implementation was disabled due to concerns about interfering with normal terminal input. This ticket implements a more robust version that:
1. Uses specific pattern matching for known permission prompts
2. Implements a debounce mechanism (200ms) to prevent duplicate responses
3. Clears the buffer after auto-answering to prevent re-matching the same prompt
4. Uses a 50ms delay before responding to ensure the prompt is fully rendered

---

## Implementation Plan

* [x] Review the disabled auto-answer logic in ptyHost.js
* [x] Implement robust permission-prompt detection with these patterns (case-insensitive):
  - `Allow? (y/n)`
  - `Proceed? (y/n)`
  - `Continue? (y/n)`
  - `Approve? (y/n)`
  - `Grant permission? (y/n)`
* [x] Add debounce mechanism (200ms between auto-answers)
* [x] Add 50ms delay before sending the response
* [x] Clear buffer after auto-answering to prevent duplicate matches
* [x] Verify the entire chain is wired correctly:
  - Settings UI toggle → `auto_accept_permissions` setting
  - AgentTerminal loads setting and passes to spawn
  - TerminalService forwards to ptyHost
  - ptyHost tracks per-session and auto-responds
* [ ] Build and test with a real agent
* [ ] Update documentation
* [ ] Commit changes

---

## Files Modified

- `src/main/ptyHost.js` - Re-enabled and improved auto-answer logic
- `AUTO_ACCEPT_PERMISSIONS_IMPLEMENTATION.md` - Documentation (already exists, will update)

Files that were already correctly implemented (no changes needed):
- `src/renderer/views/SettingsView.jsx` - UI toggle and persistence
- `src/renderer/components/AgentTerminal.jsx` - Load setting and pass to spawn
- `src/main/services/TerminalService.js` - Forward autoAnswerPermissions to ptyHost

---

## Testing

- [ ] Toggle appears in Settings > General Settings
- [ ] Toggle state persists after app restart
- [ ] When enabled, permission prompts are auto-answered with "y"
- [ ] When disabled, permission prompts require manual response
- [ ] No interference with normal terminal input (typing, spacebar, etc.)
- [ ] No duplicate responses (debounce working correctly)
- [ ] Works with claude-sonnet-4-5 (Vertex AI) or other models without --dangerously-skip-permissions

---

## Result

Successfully re-enabled the auto-accept permissions feature with an improved implementation that includes:

1. **Robust Pattern Matching**: Uses case-insensitive regex patterns for 5 common permission prompt formats
2. **Debounce Protection**: 200ms cooldown between auto-answers prevents duplicate responses
3. **Buffer Management**: Rolling 500-character buffer catches prompts split across chunks, cleared after each match
4. **Timing Controls**: 50ms delay before responding ensures prompt is fully rendered
5. **Session Isolation**: Per-session tracking via Map, cleaned up on session exit

The implementation passes through the entire chain:
- SettingsView.jsx: UI toggle and persistence to `auto_accept_permissions` setting
- AgentTerminal.jsx: Loads setting and passes `autoAnswerPermissions` to terminal spawn
- TerminalService.js: Forwards option to ptyHost
- ptyHost.js: Implements the auto-answer logic per session

Code builds successfully. Ready for live testing with a real agent.

---

## Notes

The auto-answer logic implementation uses:
- Rolling 500-character buffer to detect prompts split across chunks
- Case-insensitive regex patterns for common CLI permission prompts
- 200ms debounce to prevent duplicate auto-answers
- 50ms delay before sending 'y\r' to ensure prompt is fully rendered
- Buffer clear after each auto-answer to prevent re-matching

This approach is more robust than the previous implementation and should not interfere with normal terminal input because:
1. It only matches very specific prompt patterns (with parentheses and exact format)
2. The debounce prevents rapid-fire responses
3. Normal typing won't match these patterns
4. The buffer is limited to 500 chars, so it won't accumulate indefinitely

---

## Closed
