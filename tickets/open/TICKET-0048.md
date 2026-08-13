# TICKET-0048

**Type:** Bug  
**Status:** Completed  
**Created:** 2026-08-13  
**Closed:** 2026-08-13

---

## Summary
Fixed terminal spacebar not working after certain interactions. User reported that the spacebar stopped inputting spaces in the agent terminal, but clicking the screenshot button (📸) would mysteriously restore functionality.

## Problem
The xterm.js terminal instance was losing keyboard focus in certain scenarios, causing keyboard input (especially spacebar) to stop working. Clicking the screenshot button inadvertently "fixed" it by triggering React re-renders and state updates that coincidentally restored focus.

## Root Cause
1. The terminal was never explicitly given focus after being created and mounted
2. There was no mechanism to restore focus if it was lost due to user interactions (clicking buttons, etc.)

## Solution
Added explicit terminal focus management:
1. Store the terminal instance in a `terminalRef` for programmatic access
2. Call `term.focus()` immediately after opening the terminal to ensure it starts with keyboard focus
3. Add a click handler on the terminal container that refocuses the terminal when clicked, allowing users to easily restore focus if lost

## Files Modified
- `src/renderer/components/AgentTerminal.jsx`:
  - Added `terminalRef` to store the terminal instance
  - Called `term.focus()` after `term.open()` to ensure initial focus
  - Added onClick handler to terminal container div that calls `terminalRef.current.focus()` to restore focus when clicking anywhere in the terminal area

## Testing
- ✅ `npm run build:renderer` — clean build
- ✅ `npm test` — 13/13 pass

## Notes
This is a common pattern with xterm.js - terminals need explicit focus management since they're not standard HTML input elements. The click-to-refocus pattern matches how most terminal emulators work (click anywhere in the terminal window to ensure it has keyboard focus).

The "screenshot button fixes it" symptom was a red herring - it wasn't the screenshot functionality itself, but rather the React state updates and re-renders triggered by clicking *any* button that happened to help (likely by re-mounting or updating the terminal component in a way that coincidentally restored some focus state).
