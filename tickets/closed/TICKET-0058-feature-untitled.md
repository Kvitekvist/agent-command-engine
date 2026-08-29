# TICKET-0058: Fix Calibrate Button to Use /calibrate-enhanced Command

**Type**: Bug  
**Status**: Completed  
**Created**: 2026-08-20  
**Updated**: 2026-08-20

## Problem

The Calibrate quick action button in AgentTerminal.jsx was sending `/calibrate` instead of `/calibrate-enhanced`.

## Expected Behavior

Clicking the 🎯 Calibrate button should execute `/calibrate-enhanced`.

## Actual Behavior

Clicking the button executed `/calibrate`.

## Solution

Changed the command from `/calibrate\r` to `/calibrate-enhanced\r` in both the onClick handler and tooltip.

## Files Changed

- `src/renderer/components/AgentTerminal.jsx` (lines 370, 373)
  - Changed `window.cpi.terminal.write(sessionIdRef.current, '/calibrate\r')` to use `/calibrate-enhanced\r`
  - Updated tooltip from "Run /calibrate..." to "Run /calibrate-enhanced..."

## Testing

- [ ] Code builds (Node not available in environment)
- [ ] Tests pass
- [ ] Live verification: Calibrate button runs correct command
