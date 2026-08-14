# TICKET-0049: Add Quick Action Buttons to Agent Terminal + Prompt Count to Model Cost Table

**Type**: Enhancement  
**Status**: Open  
**Created**: 2026-08-14

## Problem

User requested:
1. Quick action buttons for common commands in the agent terminal UI
2. Prompt count column in the "Cost by Model" breakdown table

## Solution

### 1. Quick Action Buttons (AgentTerminal.jsx)
Added three new buttons alongside the Auto-approve toggle:
- **📦 Commit & Push** - Sends "Commit, push, and merge changes if needed"
- **🎯 Calibrate** - Runs `/calibrate` skill command
- **🧹 Clear** - Runs `/clear` command

All buttons:
- Only appear when terminal status is 'ready'
- Write commands directly to the terminal as if typed
- Use `\r` to auto-submit
- Include tooltips
- Flex-wrap for responsive layout

### 2. Model Cost Table Enhancement (TokenView.jsx)
Added "Prompts" column to the `ModelCostTable` component:
- Updated `byModel` aggregation to track prompt counts
- Added column header between "Model" and "Input"
- Displays localized prompt count per model
- Matches existing "By Agent" table layout

## Files Changed

- `src/renderer/components/AgentTerminal.jsx` - Added 3 quick action buttons
- `src/renderer/views/TokenView.jsx` - Added prompts column to model breakdown

## Testing

- [ ] Build clean
- [ ] Tests pass
- [ ] Live verification: buttons send correct commands
- [ ] Live verification: prompt counts display in model table

## Notes

The quick action buttons provide one-click access to frequently used operations without typing. The prompt count addition makes the model breakdown table consistent with the agent breakdown table and provides useful per-model usage metrics.
