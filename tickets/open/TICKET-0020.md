# TICKET-0020

**Status**

Open

**Type**

Bug

**Priority**

High

**Created**

2026-08-09

---

## Description

Codex agents fail to launch. Both `AgentService.sendPrompt` (headless path)
and the new per-agent embedded terminal (`agentLaunch.js`, TICKET-0019)
spawn `openai codex --model <model>`, but `openai` on this machine (and
presumably any machine with just the real Codex CLI installed) resolves to
the **openai-python SDK's CLI** (`pip install openai`, subcommands `api`,
`tools`, `migrate`, `grit`) — a completely different tool from OpenAI's
actual Codex agent CLI, which installs its own `codex` binary (npm package,
confirmed here as `codex-cli 0.146.0`, on PATH at
`%APPDATA%\npm\codex.cmd`). `codex` has no `codex` subcommand of itself, so
`openai codex ...` always fails with `invalid choice: 'codex'`.

---

## Reason

User tried launching a Codex agent from the new per-agent terminal
(TICKET-0019) and hit this exact error in the embedded terminal. Root
cause: `spawn('openai', ['codex', ...])` was never actually exercised
end-to-end before now — Codex's headless path (`AgentService.js`) has been
a known soft spot since TICKET-0018 (no session id to reconcile tokens
against, always-0 token counts), which in hindsight was a symptom of Codex
never really having been run for real, not just a reconciliation gap.

---

## Implementation Plan

* [x] Fix `src/renderer/utils/agentLaunch.js`'s codex branch: spawn `codex`
      directly (not `openai codex`), using `-m <model>` and mapping
      `permissionMode` to codex's own `-s/--sandbox` (`read-only` /
      `workspace-write` / `danger-full-access`) and `-a/--ask-for-approval`
      flags — the same three-tier safe/guarded/auto policy Claude already
      gets via `buildPermissionArgs`, translated to Codex's actual flag
      names (confirmed via `codex --help`, not guessed)
* [x] Fix `src/main/services/AgentService.js`'s headless codex branch the
      same way: `spawn('codex', ['exec', '--model', model, '--json', ...
      sandbox flags])` instead of `spawn('openai', ['codex', '--model',
      model, '--print'])` — `codex exec` is the real non-interactive
      subcommand (confirmed via `codex exec --help`), `--json` is its
      JSONL event-stream equivalent of Claude's `--output-format
      stream-json`
* [ ] Known gap, not fixed here: `AgentService.js`'s stdout parsers
      (`parseTokens`/`parseText`/`parseToolUse`/`parseSessionId`/
      `parsePermissionDenials`) are shaped for Claude's stream-json schema
      and will not correctly interpret `codex exec --json`'s actual event
      schema. Low priority to fix properly since nothing in the UI calls
      this headless path anymore (TICKET-0019 correction) — flagged so
      nobody assumes headless Codex is now fully working, only that its
      process actually starts
* [ ] Manual verification: launch a Codex agent from the Agents view,
      confirm its embedded terminal boots the real interactive `codex` CLI
      instead of erroring, for at least one permission mode other than the
      default (flag correctness confirmed directly against the installed
      `codex` binary — see Result — but not yet re-driven through a live
      agent card in the app)

---

## Files Modified

- src/renderer/utils/agentLaunch.js
- src/main/services/AgentService.js

---

## Testing

`npm run build:renderer` / `npm run build:main`; manual verification
pending (see checklist).

---

## Result

Fixed both call sites and confirmed the actual flag set parses cleanly
against the real installed `codex-cli 0.146.0` (`codex --model o3
--sandbox read-only --ask-for-approval untrusted --help` exits 0 with no
argument errors, vs. the original `openai codex --model ...` which always
failed with `invalid choice: 'codex'` since `openai` on PATH is the
unrelated openai-python SDK CLI). Added `buildCodexArgs` unit tests
alongside the existing `buildPermissionArgs` ones; full suite (10 tests)
and both `npm run build:renderer` / `build:main` pass. Not yet
re-verified against a live agent card in the running app (the environment
gotcha documented in TICKET-0019 Notes — this session's own
`ELECTRON_RUN_AS_NODE=1` — makes each live-app check a deliberate step,
not a quick one, so it wasn't repeated for this narrower fix).

---

## Notes

Did not touch `CODEX_MODELS` in `AgentView.jsx`
(`codex-mini-latest`/`o3`/`o4-mini`) — whether those are valid model names
for the real `codex` CLI is unverified and a separate concern from the
binary-invocation bug reported here.

---

## Closed

