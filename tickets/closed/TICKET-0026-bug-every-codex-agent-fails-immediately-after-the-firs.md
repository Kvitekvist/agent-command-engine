# TICKET-0026 — Every Codex agent fails immediately after the first prompt

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

Every Codex agent fails immediately after the first prompt with:

```
{"type":"error","status":400,"error":{"type":"invalid_request_error",
"message":"The 'codex-mini-latest' model is not supported when using
Codex with a ChatGPT account."}}
```

The session then drops back to the PowerShell prompt.

---

## Reason

`AgentView.jsx`'s `CODEX_MODELS` list (`codex-mini-latest`, `o3`,
`o4-mini`) are raw OpenAI-platform (API-key) model slugs. This machine's
Codex CLI is authenticated with `codex login` via a ChatGPT subscription
(`codex login status` → "Logged in using ChatGPT"), not an API key, and
the Codex CLI rejects all three slugs outright for that auth mode —
confirmed live in a running agent card, and independently via the error
message's own wording. Cross-checked against this machine's own
`~/.codex/models_cache.json` (the CLI's own cached model list, fetched
2026-08-09 by codex-cli 0.147.0): the account-compatible slugs are
`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4`,
`gpt-5.4-mini` (plus two internal/hidden routing aliases, excluded).

---

## Implementation Plan

* [x] Replace `CODEX_MODELS` in `AgentView.jsx` with ChatGPT-account-
      compatible slugs: `gpt-5.6-terra` (balanced, default), `gpt-5.6-sol`
      (frontier), `gpt-5.6-luna` (fast/affordable)
* [x] Follow-up (found live 2026-08-09, reported by user again after the
      above landed): the fix above only changed the create-agent dropdown.
      Four agents created before it ("Agent 1", "Elena", "Anton", "Omar")
      still had `codex-mini-latest` saved on their `agents.model` DB
      column, so every relaunch kept hitting the exact same "model not
      supported" error regardless of the dropdown fix. Added a one-time,
      idempotent data migration in `DBService._migrateSchema()` that
      updates any `codex` agent row still holding `codex-mini-latest`,
      `o3`, or `o4-mini` to `gpt-5.6-terra`
* [ ] Manually verify: restart the app (main-process/DB change, not
      picked up by Vite HMR — see architecture.md's `npm run dev` gotcha),
      then send a prompt from one of the previously-broken agents and from
      a newly-created Codex agent, confirm neither hits "model not
      supported"

---

## Files Modified

- `src/renderer/views/AgentView.jsx`
- `src/main/services/DBService.js`

---

## Testing

`npm run build:renderer` / `npm run build:main` (both clean) and `npm
test` (11/11 pass, all pre-existing — no automated coverage for either
change: the renderer fix is a hardcoded model-name list, same as
`CLAUDE_MODELS`, and the DB migration is data cleanup with no schema
change to assert against). Live manual verification still open — this
was found live in the user's own running window (a launched Codex agent,
"Omar", still using the pre-fix slug after the dropdown-only fix), and
the DB migration only takes effect after an app restart (sql.js is
loaded into memory once at `DBService.init()`, so it can't self-repair
rows in an already-running instance); the user should restart the app
and confirm previously-broken agents now launch cleanly.

---

## Result

Root cause: hardcoded Codex model list used raw API-key-only model slugs,
which the Codex CLI rejects outright for ChatGPT-subscription logins
(this machine's actual auth mode). Replaced with slugs read from the
CLI's own local model cache for this exact account/version, so they're
known-valid rather than guessed. Follow-up root cause: the dropdown fix
alone left already-created agents' persisted `model` column untouched, so
they kept launching with the invalid slug baked into their DB row on
every relaunch (including the automatic ones TICKET-0027/TICKET-0030 added
for tab/project switches). Fixed with a one-time startup data migration
that repairs any stale `codex` agent row in place.

---

## Notes

Like `CLAUDE_MODELS`, this list is a hand-maintained snapshot, not a live
query — it will go stale as Codex ships new models. There's no CLI flag
to list valid models directly (`codex --help`/`codex exec --help`
checked); `~/.codex/models_cache.json` is itself just a client-side cache
of the CLI's own last successful fetch, so it's a reasonable manual
source to re-check against next time this breaks, not a documented public
API. Whether this same class of bug also affects any other install
(API-key auth instead of ChatGPT) wasn't checked — this fix targets the
account type actually in use on this machine, per project_memory.md's
existing "User has Claude Code CLI and OpenAI Codex CLI installed" note.

Once TICKET-0031 (in-place model switch from an agent's chat card) lands,
this whole class of bug — a model going stale on an already-created
agent — gets a proper UI fix instead of relying on a DB migration; this
migration is a stopgap for the data that already exists on this machine,
not a substitute for that.

---

## Closed

