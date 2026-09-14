# TICKET-0131 — Isolate terminal scroll from the project view; Alt+click hint on links

**Status**

Open

**Type**

Feature

**Priority**

Low

**Created**

2026-09-13

---

## Description

Two small terminal-interaction fixes requested in the same session:

1. Scrolling inside one agent's terminal must never also scroll the
   project/agent-grid view behind it -- the two need to be independent.
2. Links in the terminal (URLs via `WebLinksAddon`, file paths via the
   custom link provider) already open on a plain click, which is one
   accidental click away from firing during ordinary text selection.
   Gated both behind Alt+click and added a hover tooltip ("Alt+Click to
   open") so that requirement is discoverable.

---

## Reason

User-reported UX issue (scroll) and a follow-on UX request (link tooltip)
in the same session.

---

## Implementation Plan

* [x] `overscroll-behavior: contain` on `.xterm-viewport` (xterm's own
      internal scroll element) -- stops unconsumed wheel delta at the
      terminal's own top/bottom from chaining up into the agent-grid/project
      scroll container. Native CSS, no JS.
* [x] `WebLinksAddon` handler and the custom file-path link provider's
      `activate` both now require `event.altKey`.
* [x] Shared hover/leave-driven tooltip ("Alt+Click to open") for both link
      sources, via `WebLinksAddon`'s `hover`/`leave` options and xterm's own
      per-link `hover`/`leave` callbacks.

---

## Files Modified

* `src/renderer/styles/globals.css`
* `src/renderer/components/AgentTerminal.jsx`

---

## Testing

* `npm run build:renderer`
* Manual: scroll inside a terminal at its scrollback limit, confirm the
  agent grid behind it does not move; hover a URL/file path, confirm the
  tooltip appears and a plain click no longer opens it.

---

## Result



---

## Notes



---

## Closed

