# TICKET-0128 — Model catalog refresh and a Settings → Models visibility control

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Low

**Created**

2026-09-05

---

## Description

`src/renderer/utils/modelCatalog.js` is the single source for both the
launch-bar model dropdown (`AgentView`) and the Settings → Models visibility
list (`SettingsView`). Two changes:

1. **Add GPT-6 Astra** (`gpt-6-astra`), released 2026-09-03, as a new `GPT-6`
   group at the top of the `codex` provider list. It is newer than the
   existing GPT-5.6 Sol/Terra/Luna entries.
2. **Restore the Claude 4 group.** An earlier uncommitted edit had trimmed it
   to just Haiku 4.5; the Opus 4.8 / 4.7 / 4.6 / 4.5 and Sonnet 4.6 / 4.5
   entries (all present in the last committed catalog) are back.

`claude-fable-5` → `claude-fable-5-1` is also applied.

Claude Mythos 5.1 (`claude-mythos-5-1`) is deliberately **not** added: it is
Project Glasswing / trusted-access only, so it does not belong in a
subscription-CLI selector.

3. **Settings → Models tab.** A per-provider checkbox list of every catalog
   model, grouped by family. Unticked models are dropped from the launch-bar
   model dropdown (`filterGroupsByEnabled`); an empty set means "no filter,
   show all". Backed by `enabled_models_claude` / `enabled_models_codex`
   settings. `getAllModelIds` / `filterGroupsByEnabled` are the shared helpers
   in `modelCatalog.js`; `AgentView` applies the same filter to its launch
   bar.

---

## Reason

The catalog should list the current frontier options for each provider. GPT-6
Astra shipped after the last catalog edit; the Claude 4 entries were dropped
by accident, not by decision.

---

## Implementation Plan

### Audit continuation, 2026-09-14

Use shared successful-settings revision updates, preserve intentional manual selections, reconcile hidden models and distinguish unset from empty preferences.

* [x] Add a `GPT-6` group with `gpt-6-astra` to `MODEL_GROUPS_BY_PROVIDER.codex`
* [x] Restore the full Claude 4 option list
* [x] `getAllModelIds` / `filterGroupsByEnabled` helpers in `modelCatalog.js`
* [x] Settings → Models tab (`SettingsView`): per-provider checkbox list,
  `enabled_models_*` settings, "Save Model Visibility"
* [x] `AgentView` launch bar filters its model dropdown by the same set
* [x] CHANGELOG entry

---

## Files Modified

Audit continuation: modelCatalog.js, ModelSelector.jsx, SettingsView.jsx, AgentView.jsx, useStore.js; model-catalog.test.js.

- `src/renderer/utils/modelCatalog.js`
- `src/renderer/views/SettingsView.jsx`
- `src/renderer/views/AgentView.jsx`
- `CHANGELOG.md`

---

## Testing

Audit continuation: Unset/empty/filtered catalog tests and build pass. Still verify uncheck-all, disable-selected, provider switch and settings reload UI paths. Legacy Auto conservatively chooses an installed provider.

- `cd src && npm test` — 74 tests, 73 pass, 1 skipped (POSIX-only), unchanged
- `cd src && npm run build` — renderer builds clean

Still to verify live: launch bar model dropdown and Settings → Models both
list GPT-6 Astra and the restored Claude 4 models (a saved
`enabled_models_*` set from before this change hides new ids until re-saved;
a fresh install shows all).

---

## Result

Audit changes are implemented in the working tree, not yet committed or released.
Remaining verification is recorded in docs/agents/audit-2026-09-13.md.

---

## Notes

For existing users upgrading, no `enabled_models_*` setting exists yet, so the
dropdown shows every catalog model. Only someone who already opened the
unreleased Settings → Models tab and saved a subset would need to re-tick the
new entries.

---

## Closed
