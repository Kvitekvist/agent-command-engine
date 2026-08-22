# TICKET-0025 — Hide the CLI's own startup splash (account/session banner, "What's

**Status**

Open

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-09

---

## Description

Hide the CLI's own startup splash (account/session banner, "What's new",
"Tips for getting started", etc.) that reprints in an agent's terminal
card every time it's launched — including every time `AgentTerminal`
remounts, e.g. leaving and returning to the Agents tab (a related but
distinct issue from TICKET-0024's duplicate-store-entry bug).

---

## Reason

Neither `claude --help` nor `codex --help`, nor the bundled `claude.exe`'s
own known `CLAUDE_CODE_*` env vars, expose a flag to suppress this splash
in interactive mode — it's simply what the real CLI prints on every fresh
session start, and `AgentTerminal` starts a fresh CLI session on every
mount (see architecture.md Terminal section). Since ACE already launches
the CLI by typing a command into the PTY rather than passing `--print`,
the cleanest fix is display-only: hide the card behind a loading overlay
briefly, then clear the local xterm.js buffer (never touches the real
process) once the splash has had time to render, revealing the
already-clean live session.

---

## Implementation Plan

* [x] Add a `showBanner` overlay state to `AgentTerminal.jsx`, cleared
      (with `term.clear()`) after a fixed `LAUNCH_BANNER_HIDE_MS` delay
* [x] Reveal immediately (no clear) if the session errors or exits before
      the timer fires, so that message isn't hidden
* [x] Clean up the timer on unmount
* [ ] Manually verify: launch a new agent and confirm the splash is not
      visible (or only flashes briefly) before the overlay clears

---

## Files Modified

- `src/renderer/components/AgentTerminal.jsx`

---

## Testing

`npm run build:renderer` (clean build) and `npm test` (11/11 pass, all
pre-existing — this change has no automated coverage since it's a
timing-based terminal-display behavior). Live manual verification still
open, same reasoning as TICKET-0024: the user's dev window has real
in-progress agent sessions on another project.

---

## Result

Implemented a fixed 1200ms delay before hiding the overlay and clearing
the terminal's local display buffer. Deliberately timing-based rather
than matching specific CLI output strings, since the splash text differs
between Claude and Codex and across CLI versions — a fixed delay degrades
gracefully (worst case: a brief flash of the banner) instead of silently
never revealing if a future CLI version's output no longer matches an
expected marker.

---

## Notes

Related but distinct from TICKET-0024: that fixed duplicate *store*
entries; this hides the *visual* re-launch noise that happens on every
legitimate remount (which still happens on every tab switch away and
back — `AgentTerminal` always starts a brand-new CLI session on mount,
a known limitation already documented in architecture.md and tracked as
an open decision in project_memory.md's Active Priorities). If terminal
sessions are ever made to survive a remount, this splash-hiding logic
would only run once per genuine launch instead of every tab switch.

---

## Closed

