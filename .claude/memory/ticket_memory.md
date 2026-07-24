# Ticket Memory

This file provides a quick overview of completed work.

Append entries only.

---

## Completed Tickets

TICKET-0001
2026-07-19
Bootstrapped Claude Projects Interface (CPI) — Electron + React + Tailwind + Vite + SQLite scaffold,
IPC bridge, DBService with full schema, AgentService (spawn claude/codex CLI subprocesses),
LoadBalancer, OptimizationAdvisor, all renderer views (AgentView, AuditView, TokenView, SettingsView),
Sidebar project switcher, ModelSelector component, Zustand store, setup/run/build scripts, README, CHANGELOG.

TICKET-0012
2026-07-22
Fixed Token Usage tab showing no/wrong data. Two stacked causes: (1) AgentService reported
lifetime token totals as if they were per-turn deltas — fixed by snapshotting counters at
turn start and reporting only the delta; (2) the dominant cause — DBService.logPrompt always
computed lastInsertRowid as 0 (see TICKET-0013), so updatePromptTokens silently updated a
row that didn't exist and token columns never reached the DB at all. Verified via a
standalone DB round-trip script; live multi-turn behavior against a real Claude CLI session
not re-verified end-to-end (no live CLI session available in this environment).

TICKET-0013
2026-07-22
Fixed agent responses missing from restored conversation history after reopening the app.
Root cause had two parts: (1) AgentService's stdout handler split each raw data chunk on
'\n' independently instead of buffering across chunks, so a JSON line split mid-chunk
(often the final result line) silently failed to parse; (2) the deeper cause — DBService's
prepare().run() called save() (sql.js db.export()) right after every write, and export()
resets last_insert_rowid() to 0 as a side effect. logPrompt queried last_insert_rowid()
in a separate call *after* save() had already zeroed it, so it always returned 0 instead
of the real row id, and updatePromptTokens(0, ...) never touched a real row — response_text
was never persisted for any prompt, regardless of fix (1). Fixed by reading
last_insert_rowid() inside run(), before save(), and returning it as lastInsertRowid.
Verified with a standalone DB round-trip script (logPrompt → updatePromptTokens →
getPrompts): promptId was 0 and response_text stayed null before the fix; both are
correct after. Also confirmed a clean `npm run build` and a crash-free `npm run dev`
launch. This same DBService bug is the likely dominant cause of TICKET-0012 as well.

TICKET-0014
2026-07-24
Completed the reliability-alpha pass: corrected production packaging, added
execution-scoped audit tracking, rejected overlapping turns, surfaced CLI
launch failures, made database replacement atomic, added four automated stream
and permission-policy tests, and reconciled version and architecture docs.
Verified tests, production build, and Windows NSIS installer creation.

TICKET-0017
2026-07-24
Fixed DBService.init() locating the sql.js WASM binary via a __dirname-relative
path — broke once DBService.js was copied to dist/ at build time, since the
derived path pointed at a nonexistent dist/node_modules. Fixed by resolving the
package through require.resolve('sql.js/dist/sql-wasm.js') instead, which
survives being copied and works inside a packaged app. Found already applied,
uncommitted, in the working tree at the start of this session — no ticket
previously documented it, so this ticket formalizes it. Verified via
npm run build and the existing automated test suite.
