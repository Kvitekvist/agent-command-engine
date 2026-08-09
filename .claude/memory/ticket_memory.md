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

TICKET-0018
2026-08-03
Fixed unreliable token tracking (Codex always 0; Claude undercounted by
ignoring cache tokens; cost was a hand-maintained static table) by adopting
tokscale, following the same technique as the user's reference project
(token-monitor): read Claude Code's/Codex's own local session transcript
files instead of trusting live CLI stdout. New TokscaleService spawns
tokscale (`ELECTRON_RUN_AS_NODE=1` shim trick) and returns per-session
cumulative usage keyed by client+sessionId — verified against a real
`tokscale --json --client claude --group-by client,session,model` run,
whose sessionId matched the exact id AgentService already captures via
parseSessionId. Since a synchronous tokscale call measured ~1-2s (too slow
to gate the response path), the fast stdout-parsed numbers still post
immediately on 'agent:prompt-done'; a fire-and-forget reconciliation
(_reconcileTokens/computeTokscaleDelta) corrects the DB row moments later
via a new 'agent:tokens-reconciled' event once tokscale resolves, adding
cache_read_tokens/cache_creation_tokens/cost_usd (new prompts columns,
migrated) and replacing the estimated cost with tokscale's real figure.
Codex reconciliation was explicitly scoped out: codex is spawned stateless
(no --resume), so there's no stable per-turn session id to match against a
tokscale row, and guessing via "newest codex session file" would misattribute
tokens once multiple Codex agents finish close together (this app allows
that). Verified: real tokscale spawn + parse against this machine's actual
Claude session history, a simulated pre-migration sql.js DB run through the
schema migration + updated queries, 9 automated tests (new
tokscale-service.test.js + reconciliation-delta tests in
agent-service.test.js), and a clean npm run build.

TICKET-0022
2026-08-09
Added a live token-usage dashboard to the Token Usage tab (now the app's
default tab), ported from the design of the user's reference app
token-monitor: Claude + Codex cards showing real subscription quota
(5-hour rolling/weekly limits with reset countdowns), today's usage by
model and by project, and a total — all sourced live from the already-
installed tokscale binary's own `usage --json` and `--today --group-by
workspace,model` commands, independent of CPI's `prompts` DB table
(which TICKET-0019's embedded terminal no longer populates). Kept the
existing Recharts historical view underneath, relabeled as DB-scoped
history rather than deleted. Verified live via Chrome DevTools Protocol
automation: real quota percentages, reset countdowns, and per-project
token totals rendered correctly with no console errors, and the app
opened directly on this tab with no click needed.

TICKET-0023
2026-08-09
Added a compact quota bar (UsageBar.jsx) above the Agents tab's toolbar:
one slim row per provider showing % used, % available, and a reset
countdown for the primary quota metric (Claude's 5-hour rolling window,
Codex's weekly), so that's visible while actually launching/watching
agents without switching to Token Usage. Lifted the live-usage poll
TICKET-0022 had local to TokenView.jsx into the zustand store
(`liveUsage`/`loadLiveUsage`), started once from App.jsx on a shared 60s
interval, so the new bar and the Token Usage tab's full UsageCard pair
read one poll instead of each spawning its own tokscale subprocess call.
Token Usage tab itself is visually unchanged, only re-wired to the shared
store slice. Verified live against the app's own already-running window
(real Claude/Codex quota numbers, matching between both tabs, real running
agent cards unaffected underneath). Found and safely tore down a
duplicate second app instance this ticket's own verification step
accidentally spawned (both pointed at the same on-disk SQLite database) —
see the ticket's Notes for the process-tree diagnosis.

TICKET-0024
2026-08-09
Fixed duplicate agent cards (and, for a running agent, a duplicate real
terminal/CLI process) appearing after leaving the Agents tab and
returning without switching projects. Root cause: AgentView.jsx's restore
useEffect reruns on every AgentView mount, not just a real project
switch, because App.jsx renders AgentView conditionally so tab switches
unmount/remount it — but the `agents` array lives in the Zustand store,
not component state, and was only cleared on a project switch. The
effect had no guard against an agent row already present in the store,
so every return trip re-added it, and for a running agent, mounted a
second AgentTerminal that spawned a second PTY session and re-launched
the CLI. Fixed by skipping any row whose agentId already exists in the
store before adding it. Verified via a clean npm run build:renderer and
the full automated test suite (11/11 pass); live in-app verification
deliberately deferred since the user's running dev window had real
in-progress agent sessions on another project at the time — see the
ticket's Testing/Notes.

TICKET-0025
2026-08-09
Hid the real CLI's own startup splash (account info, "What's new", tips)
that reprints in an agent's terminal card on every launch, including
every AgentTerminal remount (e.g. a tab switch away and back to an
already-running agent, distinct from TICKET-0024's duplicate-store-entry
bug). Neither `claude --help`/`codex --help` nor the bundled claude.exe's
own known CLAUDE_CODE_* env vars expose a flag to suppress it. Fixed by
covering the card with a "Launching…" overlay for a fixed 1200ms delay,
then calling xterm.js's local `term.clear()` (display-only, doesn't touch
the real process) and revealing the already-clean session — timing-based
rather than matching specific CLI output text, since that text differs
between Claude/Codex and across CLI versions and a fixed delay degrades
gracefully instead of hanging if a future CLI's output no longer matches.
Reveals immediately without clearing if the session errors or exits
before the timer fires, so that message isn't hidden. Verified via a
clean npm run build:renderer and the full automated test suite (11/11
pass, no new coverage since this is timing-based terminal-display
behavior); live in-app verification still open, same reasoning as
TICKET-0024.

TICKET-0026
2026-08-09
Fixed every Codex agent failing on its first prompt with "The
'codex-mini-latest' model is not supported when using Codex with a
ChatGPT account." Found live in a running agent card ("Omar"). Root
cause: CODEX_MODELS in AgentView.jsx (codex-mini-latest, o3, o4-mini) are
raw OpenAI-platform API-key model slugs; this machine's Codex CLI is
authenticated via a ChatGPT subscription (codex login status), which
rejects all three. Cross-checked against this machine's own
~/.codex/models_cache.json (the CLI's own cached model list, fetched the
same day by codex-cli 0.147.0) for the actual ChatGPT-account-compatible
slugs, and replaced the list with gpt-5.6-terra (balanced, default),
gpt-5.6-sol (frontier), gpt-5.6-luna (fast/affordable) — excluding two
internal/hidden routing aliases also present in the cache. Verified via a
clean npm run build:renderer and the full automated test suite (11/11
pass, no new coverage since this is a hardcoded model-name list, same as
CLAUDE_MODELS); live in-app verification (a fresh Codex agent completing
a prompt) still open.
