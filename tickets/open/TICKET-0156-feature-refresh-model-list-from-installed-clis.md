# TICKET-0156 — Refresh the model dropdown from the installed CLIs

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-27

---

## Description

New Claude and OpenAI models (Opus 5.5, GPT-6 Sol/Luna) shipped after the
static catalog in `modelCatalog.js` was last edited. Add a launch-bar button
that finds new models and adds them to the model dropdown without an app
update.

---

## Reason

The catalog was hand-maintained, so every model release needed a new ACE
build before users could pick it.

---

## Implementation Plan

* [x] `ModelDiscovery.js`: silently run `claude -p /cost --no-session-persistence`
  and `codex debug models` (no model call) so each CLI refreshes its own
  model cache, then read `~/.claude/cache/model-catalog/*-cc.json` and
  `~/.codex/models_cache.json`. Missing CLI or cache yields [] for that provider.
* [x] `models:discover` IPC + `window.ace.discoverModels`.
* [x] `modelCatalog.js`: `getModelGroups` adds unknown ids as a leading
  "New from CLI" group; `newModels` diffs before/after for the popup.
* [x] Launch bar "🔄 Models" button, saves `discovered_models`, ticks new ids in
  a saved Settings → Models subset, popup lists added models or "No new models found".
* [x] Settings → Models and Default Model include discovered models.
* [x] Fix: AgentView's enabled-model state defaulted to a Set of the static ids,
  which filtered discovered models out of the dropdown. Now null (no filter).

---

## Files Modified

- `src/main/services/ModelDiscovery.js` (new)
- `src/main/services/AgentService.js` (export `buildChildEnv`)
- `src/main/ipc/handlers.js`, `src/main/preload.js`
- `src/renderer/utils/modelCatalog.js`
- `src/renderer/views/AgentView.jsx`, `src/renderer/views/SettingsView.jsx`
- `src/renderer/components/ModelSelector.jsx`
- `src/tests/model-catalog.test.js`

---

## Testing

- `cd src && npm test`: 135 pass, 1 skipped (POSIX-only)
- Real refresh on the dev machine: ~6 s, found claude-opus-5-5, gpt-6-sol, gpt-6-luna.
- Popup verified live on a VM; the dropdown fix is in v0.1.39, still to verify live.
- macOS: no platform branches. `providerExecutable` returns the bare command and
  `ensureShellPath` gives a Finder launch the login-shell PATH; cache paths are
  home-relative on both platforms. Not run on a Mac.

---

## Result

Shipped in v0.1.39.

---

## Notes

Both cache files are undocumented CLI internals. A format change makes that
provider find nothing; the static catalog still applies.

---

## Closed
