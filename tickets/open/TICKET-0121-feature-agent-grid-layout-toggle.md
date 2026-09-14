# TICKET-0121 — Toggle the agent grid between two columns and one wide column

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Low

**Created**

2026-09-03

---

## Description

The Agents view lays agent cards out in a fixed responsive grid: one column,
two columns at the `xl` breakpoint. There is no way to get a single
full-width column when you want one agent's terminal to have the whole pane.

Add a toolbar toggle (next to the sound-mute button) that switches between:

- `2` — the current `grid-cols-1 xl:grid-cols-2` behaviour (default)
- `1` — forced `grid-cols-1`, one wide column

The choice is remembered per machine in `localStorage`
(`ace:agentGridCols`), the same pattern as the draggable sidebar width
(TICKET-0104).

---

## Reason

Small quality-of-life change. A wide single column suits reading a long agent
transcript or a build log without the card being half-width on a large
display.

---

## Implementation Plan

### Audit continuation, 2026-09-14

Preserve existing one/two-column toggle; add focus without remounting PTYs and constrain long headers.

* [x] `AgentView.jsx` — `gridCols` state seeded from `localStorage`, `toggleGridCols` writer
* [x] Toolbar button (▦ / ▤) with a describing `title`
* [x] Grid `className` picks `grid-cols-1` vs `grid-cols-1 xl:grid-cols-2`

---

## Files Modified

Audit continuation: AgentView.jsx.

- `src/renderer/views/AgentView.jsx`
- `CHANGELOG.md`

---

## Testing

Audit continuation: Build passes; focus resets on project switch. Still check one/two/six agents at 800x600, 1400x900 and 200% zoom with long titles.

- `npm run build` from `src/`
- Manual: toggle the button, confirm the cards go one-wide / two-up and the
  choice survives a reload

---

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

Implemented as a per-machine `localStorage` toggle, no store or IPC changes.
Class logic is a one-line ternary on the existing grid container.

---

## Notes

Layout-only CSS toggle, no runnable check added (trivial per project
conventions).

---

## Closed

