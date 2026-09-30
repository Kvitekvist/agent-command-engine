# TICKET-0166: Prevent settings loss when toggling integrations

**Status**

Awaiting verification

**Type**

Bug

**Priority**

High

**Created**

2026-09-29

---

## Description

Make integration toggles preserve existing settings when JSON is invalid, a read fails, or another writer creates the settings file between read and save.

## Reason

claudeSettings.mjs converts invalid JSON to an empty object before writing. It also converts a missing-file expected value from null to undefined, disabling FileService's conflict check. In-memory review checks confirmed both behaviors.

## Implementation Plan

* [x] Distinguish ENOENT from other read failures and reject malformed or non-object settings with a visible error.

* [x] Preserve null as the expected content for an absent file so concurrent creation returns a conflict.

* [x] Reuse the existing FileService conflict-aware writer and preserve unrelated settings keys.

* [x] Check every readLocalSettings/writeLocalSettings caller for error propagation and retain user input after failures.

* [x] Add focused regressions for malformed JSON, invalid JSON shapes, failed reads, missing-file concurrent creation and preservation of unrelated keys.

## Files Modified

- `src/main/ipc/handlers.js`: `fs:readFile` failures carry `code`, the same as `fs:readDir`, so callers can tell a missing file from a failed read.
- `src/renderer/utils/claudeSettings.mjs`: `ENOENT` reads as `{ settings: {}, raw: null }`; other read failures, malformed JSON and non-object values throw. Writes re-parse `raw` (never falling back to `{}`) and pass it unchanged as `expectedContent`, so `null` makes a concurrently created file a conflict.
- `src/renderer/components/ProjectSkillsPanel.jsx`: the only caller. A settings read failure shows inline and disables the toggles while skills and MCP servers still list. All three toggles go through one `updateSettings` helper that catches errors and reloads only on success, so the plugin id you typed survives a failed save.
- `src/tests/claude-settings.test.js` (new).

## Testing

- `tests/claude-settings.test.js`, against the real FileService: missing file read and create; unrelated keys preserved; malformed JSON, `[]`, a string and `null` all rejected with the file left untouched; a non-ENOENT read failure rejected; a file created after an absent read returns `conflict` and is not overwritten. The malformed and concurrent-creation cases fail on the previous code.
- `npm test`: 144 tests, 143 pass, 0 fail. `npm run build` passes.
- Manual toggle error/retry in the running app: not done.

## Result

Implemented and committed together with TICKET-0169 (the Skills / Plugins / MCP panel this fixes). Needs the manual toggle error/retry check.

## Notes

The affected helper and panel include pre-existing working-tree changes. Preserve them. Reuse TICKET-0138's existing writer rather than reimplementing file conflict handling.

## Closed

Pending.

