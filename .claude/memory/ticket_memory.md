# Ticket Memory

This file provides a quick overview of completed work.

Append entries only.

---

## Completed Tickets

TICKET-0001
2026-07-19
Bootstrapped Agent Command Engine (ACE) — Electron + React + Tailwind + Vite + SQLite scaffold,
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
workspace,model` commands, independent of ACE's `prompts` DB table
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

Follow-up, same day: user hit the identical error again after the above
landed. Cause was that the dropdown fix only affects newly-created
agents — four agents already existed with codex-mini-latest saved
directly on their agents.model DB row (confirmed by querying cpi.db
directly), and every relaunch (including the automatic ones TICKET-0027/
TICKET-0030 added on tab/project switches) kept reading that stale value
straight from the DB, bypassing the fixed dropdown entirely. Fixed with a
one-time idempotent migration in DBService._migrateSchema() that rewrites
any codex agent row still holding codex-mini-latest/o3/o4-mini to
gpt-5.6-terra. Only takes effect after an app restart (sql.js loads the
whole DB into memory once at init — an already-running instance can't
self-repair). npm run build:main / build:renderer both clean, npm test
11/11 pass; live verification (restart app, confirm a previously-broken
agent now launches cleanly) still open.

TICKET-0028
2026-08-09
Fixed ptyHost.js (the forked process hosting every agent's live PTY
session) crashing with a native access violation (exit 0xC0000005) —
observed live once, while the user was switching between projects with
multiple agents running. Root cause: switching projects resets the
`agents` store array, unmounting every AgentTerminal for the old
project's agents in the same React commit; each one's cleanup fires a
fire-and-forget `terminal:dispose` IPC send, so ptyHost.js received
several `dispose` messages back-to-back and called node-pty's
`proc.kill()` on multiple ConPTY sessions in rapid succession — a known
crash class for that native addon on Windows when teardowns overlap.
Fixed by serializing disposeSession behind a promise queue that waits for
each killed session's own onExit (1500ms timeout fallback) before the
next queued kill() runs; gracefulShutdown (full host exit) now awaits
that same queue instead of exiting before any kill() had completed.
Verified via a clean npm run build:main and the full automated test
suite (11/11 pass, no new coverage — native-process teardown timing
isn't exercised by the existing JS-level tests). Root cause is inferred
from timing + node-pty's documented Windows/ConPTY concurrency issues,
not a captured crash dump (Windows Error Reporting had no matching entry
for the crash). Live re-verification (multiple agents running, switch
projects, confirm no crash) still open — the original crash wasn't
reliably reproducible on demand.

TICKET-0029
2026-08-09
Fixed two external cmd.exe console windows briefly flashing on Windows
roughly once a minute, even with the app idle and no agents running.
This app's own spawn/fork call sites all already pass windowsHide: true
(ruled out first, including TICKET-0027's fix and AgentService's unused
headless-spawn dead code) — the real cause was third-party: tokscale's
own JS shim resolves the native tokscale.exe binary and runs it via its
own nested spawnSync(..., { stdio: "inherit" }) with no windowsHide
(node_modules/@tokscale/cli/dist/index.js:207), and that inner spawn is
what Windows actually showed a console for — our windowsHide on the
outer spawn can't reach a grandchild process a vendor package spawns
with its own options. The 60s live-usage poll (tokens:getLiveUsage,
App.jsx) calls TokscaleService.getQuota() then getTodayBreakdown() —
two tokscale invocations per poll, matching "2 windows, periodic, even
idle" exactly. patch-package was tried first to patch node_modules
directly but its auto-diff needs a registry install to diff against
(failed in this environment) and a hand-written patch also failed to
apply cleanly, so the fix lives in our own code instead:
TokscaleService.runTokscale now resolves @tokscale/cli-win32-{x64,arm64}-msvc
directly via require.resolve and spawns tokscale.exe itself with
windowsHide: true on win32, skipping the vendor shim (and its un-hidden
nested spawn) entirely; non-Windows platforms are unchanged. Verified via
a clean npm run build:main, the full automated test suite (11/11 pass),
and directly calling both real call sites (getQuota/getTodayBreakdown)
against live tokscale data through the new path. Live idle-app
verification (confirm no more flashes over several real poll cycles)
still open — needs an app restart since this is a main-process change.

Follow-up fix, same ticket: running the packaged app surfaced a second
bug in this same code path — the Usage panel showed "spawn ...
tokscale.exe ENOENT". `resolveWindowsBinary()`'s `require.resolve()`
returns the binary's path as it lives inside `app.asar`; `fs` reads
transparently work through the archive, but `spawn()` performs a real
Windows `CreateProcess`, which can't launch a binary from inside a
virtual asar archive (Electron's own docs: only `execFile` gets
asar-aware redirection, not `spawn`). The real `tokscale.exe` was
already unpacked correctly to a sibling `app.asar.unpacked` tree by the
existing `asarUnpack` config, but nothing pointed `spawn` at it. Fixed
by rewriting the `app.asar` segment of the resolved path to
`app.asar.unpacked` before spawning; dev builds are unaffected (no
`app.asar` in the path there). Worth remembering for any future
packaged-app `spawn()` of a binary resolved via `require.resolve`.

TICKET-0030
2026-08-09
Fixed agent terminal sessions not surviving a project switch — switching
away from a project and back used to unmount every running agent's
terminal (AgentTerminal.jsx disposes its PTY session on unmount) and
re-mount a brand-new one on return, losing scrollback and restarting the
CLI process, even though the user was mid-conversation. Confirmed as a
real need (previously an open decision noted in project_memory.md's
Active Priorities). Root cause: useStore.setActiveProject reset the
`agents` array on every project switch. Fixed the same way TICKET-0027
fixed the equivalent tab-switch problem: AgentView.jsx now renders every
agent across every project visited this session (not just the active
one), wrapping each card in a div toggled `hidden` based on
`agent.projectId === activeProject.id` instead of filtering it out of the
render — so a hidden project's agents stay mounted with live PTY sessions
underneath. setActiveProject no longer touches `agents` at all; only
Stop, Delete, or app quit end a session now. Empty-state message and the
new-agent default-label uniqueness check were rescoped to just the active
project's agents so they don't leak across projects. Verified via a clean
npm run build:renderer and the full automated test suite (11/11 pass, no
new coverage — same reasoning as TICKET-0027, this is store/mount-
lifecycle UI behavior); live in-app verification (switch projects with a
real running conversation, confirm scrollback survives) still open.

TICKET-0032
2026-08-09
Added per-agent screenshot folders plus a 📸 button (ScreenshotService.js,
screenshots:pasteFromClipboard IPC handler, window.cpi.screenshots) that
saves whatever image is on the OS clipboard into that agent's dedicated
folder under Electron's userData dir, then overwrites the clipboard with
the saved file's absolute path so the natural next step is pasting it
into that agent's terminal. Found already implemented, uncommitted, in
the working tree at the start of this session (like TICKET-0017) — this
ticket formalizes and verifies it. Live verification on a real running
agent (this session's own agent, "Yuki") found a real bug: right after a
successful save, the OS clipboard held the toast's own status text
instead of the file path, because the toast message was ordinary
selectable text worded in a way ("path copied") that invited
selecting/copying that line instead of just pressing Ctrl+V — silently
clobbering the real path. Confirmed by checking the live clipboard
directly and cross-referencing it against the actual saved PNG on disk.
Fixed by adding `select-none` to the toast in AgentView.jsx so it can't
be selected/copied over the real clipboard content. General pattern
worth remembering: any clipboard-handoff feature should make its own
"copied" status text non-selectable, since it sits right next to the
thing the user actually wants to paste.

TICKET-0034
2026-08-09
Reworked the screenshot feature (TICKET-0032) from clipboard-paste to
interactive drag-to-select screen capture. The 📸 button now grabs the
primary display via desktopCapturer, shows a frameless always-on-top
overlay window the user drags a selection rectangle across (Esc/right-
click cancels), crops to that region, and saves it under the active
project's own `.cpi/screenshots/` folder instead of a per-agent folder
under Electron's userData dir -- auto-appending `.cpi/` to the project's
.gitignore (created if missing) so it never gets committed. Copies the
saved file's path, relative to the project root, to the clipboard.
Rationale: clipboard-paste required a separate screenshot tool already
running and left files disconnected from the project; region capture is
one step instead of two, and project-scoped files make sense given
prompts run with the project as cwd. Found already implemented,
uncommitted, in the working tree at the start of this session -- this
ticket formalizes it and fixes two bugs found during its own live
verification: (1) the 📸 button's onClick still referenced
`pasteScreenshot`, a function left over from TICKET-0032's superseded
design and never actually defined, so clicking it (or even just
rendering a card for a running agent, since the reference was evaluated
during render) threw a ReferenceError that crashed ACE's renderer
entirely -- fixed by pointing the button at `captureScreenshot`, the
correctly-wired handler that existed but was never called from anywhere;
(2) `captureRegion` hid ACE's own main window before every capture,
directly defeating the feature's stated purpose of screenshotting ACE
itself -- removed the hide/show and the now-dead `mainWindow` field it
existed only to support. Verified via a clean npm run build:main and the
full automated test suite (11/11 pass, no new coverage -- native
Electron window/capture behavior isn't exercised by the Node test
runner). Manual verification (real drag-select capture against a running
agent, confirming file/gitignore/clipboard behavior) still open -- see
project_memory.md Active Priorities.

TICKET-0033
2026-08-09
Added a right-click context menu to files in the Sidebar's file tree
(FileTree.jsx): Open (same as the existing left-click), Open in Explorer
(reveals the file via Electron's shell.showItemInFolder), and Run --
shown only for executable-like files (.exe/.bat/.cmd/.ps1/.vbs/.com/.msi)
-- which spawns the file the same way double-clicking it in Explorer
would. New reusable ContextMenu.jsx component (position-at-cursor,
closes on outside click/Escape) since none existed yet. FileService
gained openInExplorer/runFile, both routed through the same
resolveWithinRoot containment check TICKET-0021's readDir/readFile/
writeFile already use, so Run/Open in Explorer can't reach outside the
project root either. Run is deliberately NOT windowsHide'd, unlike this
app's own background spawns (TICKET-0029) -- a user-invoked Run should
show a console window like a real double-click, not be silently hidden.
.ps1 is special-cased to spawn `powershell.exe -File` directly, since
Explorer's own default double-click verb for PowerShell scripts is Edit,
not Run (a deliberate Windows security default) -- relying on the file
association alone would open the script in an editor instead of running
it. Verified via a clean npm run build and the full automated test suite
(11/11 pass, no new coverage -- this is IPC/UI wiring and native process
spawning, same reasoning as TICKET-0021/0025/0027 etc.); manual
verification (right-click a regular file vs. a .bat/.exe/.ps1, confirm
Explorer actually opens/highlights and Run actually launches) still
open.
