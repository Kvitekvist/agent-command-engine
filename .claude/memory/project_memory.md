# Project Memory

## Project Name
Claude Projects Interface (CPI)

## Project Vision
A specialized Electron desktop application that provides a powerful interface for managing Claude (and OpenAI Codex) AI agents across multiple projects. The goal is to benchmark different project frameworks by tracking speed, token usage, and documentation quality — while keeping a full audit trail of every prompt and response for reproducibility.

---

## Current Milestone
**Milestone 2 — Reliability Alpha**
Make process execution, persistence, packaging, and provider behavior dependable.

---

## Active Priorities
* Finish manually verifying the per-agent embedded terminal (TICKET-0019
  correction): confirm a launched Codex agent boots correctly too, type a
  follow-up prompt directly into a running terminal and confirm it
  responds, get a real pixel screenshot of the CLI banner rendering
* Decide whether agent terminal sessions need to survive a project
  switch (currently they don't — see TICKET-0019 Notes) — open a follow-up
  ticket if so
* Rebuild token tracking for the new per-agent terminal path (it currently
  only works for the now-unused headless `AgentService.sendPrompt` path —
  see TICKET-0019 Notes and [[architecture]] Token Tracking)
* Verify restored stopped-agent behavior manually (TICKET-0011)
* Add end-to-end provider contract tests for Claude and Codex
* Replace whole-database export-on-write if audit volume causes UI stalls

---

## Tech Stack
- Electron (main process)
- React 18 + Tailwind CSS (renderer process)
- Vite (bundler for renderer)
- sql.js (local SQLite database persisted in Electron userData)
- Recharts (token usage visualization)
- Node.js child_process (spawn claude CLI and openai codex CLI)
- tokscale (reads Claude Code's/Codex's own local session transcripts for accurate token/cost usage — see [[architecture]] Token Tracking)
- node-pty + xterm.js (real interactive terminal embedded per agent card, forked into its own `ptyHost.js` process — see [[architecture]] Terminal)

---

## Technical Debt
- `package.json` lives in `src/`, not the repo root — `node_modules` is at
  `src/node_modules`. Scripts/tests that shell out to `node` need to run from
  `src/` (or reference `src/node_modules`) or `require('electron')` etc. won't
  resolve.

---

## Known Issues
- TICKET-0019 (per-agent embedded terminal — every launched agent's card is
  now a real interactive `claude`/`codex` terminal, not a headless chat
  thread; the original standalone floating panel was removed) is verified
  at the process level and via live-window DOM/IPC automation: PTY host
  forks and reports ready, a standalone spike confirmed the shell's real OS
  process is actually killed (not just IPC-resolved) on graceful shutdown,
  and driving a real dev window over the Chrome DevTools Protocol confirmed
  launching an agent produces a card with a live terminal and no leftover
  chat UI, and Stop actually disposes that terminal's PTY session. Still
  open: a pixel-level screenshot check that the CLI banner renders, testing
  a Codex agent specifically, and typing a follow-up prompt into a running
  terminal.
- Terminal sessions do not currently survive switching away from a
  project and back, or an app restart — each is tied to its agent card's
  mount lifecycle. See TICKET-0019 Notes.
- Audit Log / Token Usage no longer gain new rows for agents launched via
  the embedded terminal (only the old headless path wrote them, and
  nothing calls it anymore) — historical data still displays correctly.
  See TICKET-0019 Notes and [[architecture]] Token Tracking.
- TICKET-0020: Codex agents couldn't launch at all — both the headless
  path and the new embedded terminal spawned `openai codex ...`, but
  `openai` on PATH is the unrelated openai-python SDK CLI (no `codex`
  subcommand), not the real Codex CLI (`codex`, npm package `codex-cli`).
  Fixed both call sites and confirmed the corrected flags parse cleanly
  against the real installed CLI; re-driving it through a live agent card
  in the running app is still open.
- TICKET-0011 (restore stopped agents + Delete button) is implemented but its
  manual UI verification step (stop an agent, switch projects, confirm cards +
  history reappear) hasn't been run yet.

---

## Future Ideas
- Framework benchmark scoring (auto-compare project templates)
- Replay a past prompt/response sequence to reproduce results
- Export audit log to CSV/JSON
- Cost alerts when spending exceeds threshold

---

## Notes
- User has Claude Code CLI and OpenAI Codex CLI installed
- Load balance: route to Codex when Claude credits are exhausted
- All token counts parsed from CLI stdout (JSON output mode)
- One SQLite DB for the application in Electron's userData directory
- Current template project: the AI Project Bootstrap in this repo
