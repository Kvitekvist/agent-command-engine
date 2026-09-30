# TICKET-0170 — Models button finds nothing on enterprise-gateway logins

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-30

---

## Description

On the user's work PC the 🔄 Models button (TICKET-0156) never adds any
Claude models, while it works at home.

---

## Reason

The work PC signs in to Claude Code through an enterprise gateway (SSO/JWT,
`enterpriseGateway.url` in `.credentials.json`). That login never writes
`~/.claude/cache/model-catalog/*-cc.json`, the only place discovery looked;
the folder does not exist on that machine. Its models are pinned in
`~/.claude/settings.json` instead:

```
"env": {
  "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-5",
  "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5@20251001"
}
```

Found by running the button's steps by hand on the work PC (the standalone
script given in the session) and reading the CLI's config.

---

## Implementation Plan

* [x] `ModelDiscovery.discoverModels` also reads `ANTHROPIC_MODEL` and
  `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` from the environment and from
  the `env` block of `~/.claude/settings.json`, merged after the catalog
  cache with duplicates dropped.
* [x] The environment is a parameter so tests don't depend on the machine.

---

## Files Modified

- `src/main/services/ModelDiscovery.js`
- `src/tests/model-catalog.test.js`
- `CHANGELOG.md`

---

## Testing

- New test with the work PC's shape (no catalog folder, settings.json env
  block, plus an `ANTHROPIC_MODEL` env value and a blank one): finds
  `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5@20251001` once
  each; only the `@20251001` id is new to ACE's catalog, so only it lands in
  "New from CLI".
- Existing discovery tests now pass an empty environment.
- `npm test`: 147 tests, 146 pass, 0 fail.
- Not verified: the button on the work PC itself.

---

## Result

Implemented. Needs a run of the Models button on the work PC.

---

## Notes

The gateway itself may expose a model list, but its URL and auth are
organisation-specific; the pinned variables are what Claude Code actually
uses there, so they are the reliable source.

Separate, not fixed here: `buildChildEnv` strips every `CLAUDE*` variable
from the CLIs ACE spawns, which would also drop settings such as
`CLAUDE_CONFIG_DIR`, and discovery ignores `CLAUDE_CONFIG_DIR` /
`CODEX_HOME`. Not the cause on the work PC.

---

2026-09-30 follow-up (after v0.1.45): the pinned variables only held three
of the fifteen models the gateway exposes in `/model`. The source of truth is
Claude Code's own model list: the CLI answers an Agent SDK `initialize`
control request (`claude -p --input-format stream-json --output-format
stream-json --verbose --no-session-persistence`, stdin
`{"type":"control_request","request_id":"ace-models","request":{"subtype":"initialize"}}`)
with `response.response.models`, the exact `/model` menu, built from whatever
login the CLI runs under. No prompt, no model call; about 0.7 s here.

- `ModelDiscovery.listClaudeModels` runs that request and returns concrete
  ids (`value` when it is a `claude-` id, else `resolvedModel`), de-duplicated,
  with "Default" only when it points at an otherwise unlisted model.
- `refreshAndDiscoverModels` uses it for Claude and only falls back to the
  `/cost` cache refresh plus catalog and pinned variables when it returns null.
- `LaunchPolicy` rejected `@` and `[1m]` in model ids ("Invalid model ID"),
  so the 0.1.45 pinned `claude-haiku-4-5@20251001` could not have launched
  either. It now allows `@` and one `[a-z0-9]{1,8}` suffix; `agentLaunch`
  single-quotes every argument, and a test checks shell metacharacters are
  still rejected.
- Tests: the work PC's /model shape (aliases, `[1m]`, Default) mapped to 7
  ids; the control response matched by request id across split stdout; null
  on a CLI that exits without answering, a missing CLI, and a timeout.
  Verified against the real CLI on the dev machine (11 models, 730 ms).
  `npm test` 150/149 pass, 0 fail; build and renderer smoke pass.
- Not verified: the work PC itself (needs the next Store build).

---

## Closed

Pending.
