# TICKET-0070

**Type:** Feature
**Status:** Implemented — pending live verification
**Created:** 2026-08-22
**Updated:** 2026-08-22

## Description

Give every agent chat an auto-updating title, derived from the user's
initial request, to help with session management (telling apart several
running agent cards at a glance instead of relying on the random default
name).

## Problem

Each launched agent currently only has `agent.label` — a random human first
name (`generateAgentName()`) chosen before launch, editable in the launch
bar's text input, but never touched again afterward. With several agents
running (even just in one project, and more so across the several projects
`AgentView` now keeps mounted at once per TICKET-0030), the cards are hard
to tell apart at a glance — "Priya" and "Marcus" carry no information about
what either agent is actually working on.

## Plan

- Capture the first line of text the user actually submits into a running
  agent's embedded terminal (`AgentTerminal.jsx`'s `term.onData` handler) —
  the "initial request" — via a small pure buffering helper (backspace-aware,
  strips ANSI escape sequences for arrow keys etc.), finalized on the first
  `\r`/`\n`. The launch command itself (`buildLaunchCommand`) is written
  directly, not through `onData`, so it's never mistaken for the user's own
  first line.
- Derive a short title heuristically (truncate to a max length at a word
  boundary) — no extra LLM call: keeps this fast, free, and independent of
  provider/model, consistent with the rest of the app's local-first tooling.
  An empty first submitted line (e.g. accidental Enter) doesn't count —
  capture waits for the first non-empty one.
- Once derived, update `agent.label` in place (Zustand store + DB) rather
  than introducing a second parallel "title" field — `label` is already the
  one thing rendered everywhere an agent needs to be identified (card
  header, delete confirm, launch-bar uniqueness check, `agent_sessions`
  snapshot for the Token Usage "By Agent" breakdown). Only fires once per
  session (first submitted line only) — later messages don't keep re-titling
  the card.
- New `agents:updateLabel` IPC handler + `DBService.updateAgentLabel`,
  mirroring the existing `updateAgentStatus` pattern.

## Known limitation (accepted, not a bug to chase)

The capture buffer is a simple parallel reconstruction of what the user
typed — it does not perfectly replay in-line edits made with arrow
keys/Home/End inside the CLI's own readline-style input the way the real
CLI does. Escape sequences are stripped outright rather than interpreted,
so heavy in-line editing before the first Enter could produce a slightly
off title. Acceptable for a best-effort auto-title; not worth the
complexity of a real terminal-line emulator for this.

## Changes

**Added:**
- `src/renderer/utils/firstLineCapture.mjs` — pure `feedLineCapture`/
  `deriveTitle` helpers (`.mjs` deliberately, see Architecture memory's
  Auto-Title section for why)
- `src/tests/first-line-capture.test.js` — 10 cases

**Modified:**
- `src/renderer/components/AgentTerminal.jsx` — feeds `term.onData` chunks
  through the capture helper, fires the label update once per session
- `src/renderer/store/useStore.js` — new `updateAgentLabel` action
- `src/renderer/views/AgentView.jsx` — restore effect now passes
  `titleSet: !!row.title_set` through to the store
- `src/main/services/DBService.js` — new `agents.title_set` column
  (`_createSchema` + `_migrateSchema`), `updateAgentLabel(id, label)`
- `src/main/ipc/handlers.js` — new `agents:updateLabel` handler
- `src/main/preload.js` — exposes `window.cpi.updateAgentLabel`

## Testing

- [x] Pure buffering helper covered by a Node test-runner suite (typed
      text, backspace, pasted multi-line text, arrow-key escape sequences,
      empty-then-real first line) — `node --test tests/first-line-capture.test.js`,
      10/10
- [x] `npm run build:renderer` / `npm run build:main` / `node --check` on
      every modified main-process file — all clean
- [x] `npm test` full suite — 53/54; the 1 failure
      (`tests/pty-perms.test.js`) is pre-existing and unrelated (a Windows
      chmod/executable-bit limitation in TICKET-0068's POSIX spawn-helper
      test, touches no file this ticket changed)
- [ ] Live: launch an agent, type a first prompt, confirm the card's title
      updates; confirm it survives a tab switch / project switch; confirm a
      *restored* agent (stop app or switch away and back after a title was
      already set, then type a follow-up line) does NOT get re-titled by
      that follow-up — deferred per this project's usual pattern for
      terminal/main-process changes needing a live app instance (see
      TICKET-0024/0025/etc. in project_memory.md)
