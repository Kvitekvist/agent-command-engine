# TICKET-0026

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
* [ ] Manually verify: launch a Codex agent, send a prompt, confirm no
      "model not supported" error

---

## Files Modified

- `src/renderer/views/AgentView.jsx`

---

## Testing

`npm run build:renderer` (clean build) and `npm test` (11/11 pass, all
pre-existing — no automated coverage for this since it's a hardcoded
model-name list, same as `CLAUDE_MODELS`). Live manual verification
still open — this was found live in the user's own running window (a
launched Codex agent, "Omar"), but re-verifying with the corrected model
list wasn't done directly against that session since it has other
in-progress work; the user should confirm a fresh Codex agent launch
completes a prompt successfully.

---

## Result

Root cause: hardcoded Codex model list used raw API-key-only model slugs,
which the Codex CLI rejects outright for ChatGPT-subscription logins
(this machine's actual auth mode). Replaced with slugs read from the
CLI's own local model cache for this exact account/version, so they're
known-valid rather than guessed.

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

---

## Closed

