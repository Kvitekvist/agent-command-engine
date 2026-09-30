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

## Closed

Pending.
