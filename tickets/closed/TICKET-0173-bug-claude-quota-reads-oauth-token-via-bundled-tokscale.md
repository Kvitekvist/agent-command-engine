# TICKET-0173 — Claude quota read via tokscale touches the Claude OAuth token directly

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-10-20

---

## Description

`TokscaleService.getQuota()` ran the bundled `tokscale usage --json`, which
reads the user's Claude OAuth access token straight out of
`~/.claude/.credentials.json` (or the OS keychain) and calls
`https://api.anthropic.com/api/oauth/usage` with it directly — regardless of
whether the caller only wanted Codex's half of the result. ACE's own code
never touched the token, but it shipped and ran a third-party binary that
does, against a private Anthropic endpoint, which is itself a form of
intermediating the Claude.ai session token outside Claude Code.

## Reason

Flagged in a compliance review of ACE's usage-tracking implementation. The
fix: read Claude's quota from Claude Code's own statusLine hook output
instead (which the CLI already computes for its own `/model`/status
display), and scope tokscale's remaining role to Codex only, via its
provider-specific `codex status` command rather than the combined `usage`
command that touches both providers' credentials in one call.

---

## Implementation Plan

* [x] Add a `statusLine` hook (`HookService.js`) that extracts
  `rate_limits.five_hour` / `.seven_day` from Claude Code's own statusLine
  input and writes it to a local file ACE already controls — no credential
  file or network call involved.
* [x] Pass through any statusLine command the user already configured in
  their own project/user Claude settings, since installing one via
  `--settings` silently replaces it otherwise.
* [x] Replace `TokscaleService.getQuota()` with `getCodexQuota()`, using
  tokscale's `codex status --json` (Codex-account-scoped, never reads the
  Claude credential file).
* [x] Update `tokens:getLiveUsage` (handlers.js) to source Claude's quota
  from the hook file and Codex's from the scoped tokscale call, keeping the
  existing `lastGoodQuota` persistence/fallback behavior for both.
* [x] Update/rewrite the affected tests (`tokscale-quota-retry.test.js`,
  `tokscale-service.test.js`, `hook-service.test.js`, `smoke-main.js`).

---

## Files Modified

* `src/main/services/HookService.js`
* `src/main/services/TokscaleService.js`
* `src/main/ipc/handlers.js`
* `src/tests/hook-service.test.js`
* `src/tests/tokscale-quota-retry.test.js`
* `src/tests/tokscale-service.test.js`
* `src/scripts/smoke-main.js`

---

## Testing

`node --test tests/*.test.js` — 168 passed, 1 pre-existing skip, 0 failed.
Verified live with the real `tokscale.exe` binary that `codex status --json`
returns only the Codex account's usage, while `usage --json` (now unused)
still calls out to Anthropic's endpoint with the live Claude token.

---

## Result

Claude's quota bar now reads only a local file Claude Code's own statusLine
hook writes; nothing in ACE or its bundled dependencies reads the Claude
OAuth token or calls Anthropic's API directly. Tradeoff: Claude's quota is
unavailable until the first response of a session (the statusLine hook
hasn't run yet), where it previously was available immediately via the live
tokscale call.

---

## Notes

Codex's quota still goes through tokscale, scoped to the Codex account only
— out of scope for this fix since it's governed by OpenAI's terms, not
Anthropic's.

---

## Closed

2026-10-20
