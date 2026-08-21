# TICKET-0067

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-08-21

---

## Description

Token Usage → "History (this project)" shows no data on macOS/Linux (Live
Usage still shows ~60M tokens for Claude, but History is empty and shows no
price). Windows is fine.

Re-applies the fix from TICKET-0059, which was reverted in f003760 (part of
a batch revert of 0059/0060/0061) and never reinstated.

---

## Reason

`TokscaleService.getWorkspaceReport` invoked tokscale as
`report --workspace <key> --client <client>` — two separate argv tokens.
`pathToWorkspaceKey` flattens every non-alphanumeric char in the project
path to a dash; macOS/Linux paths start with `/`, so every workspace key
starts with `-` (e.g. `-Users-...-agent-command-engine`). tokscale's CLI
parser reads a `-`-leading value passed as its own token as an unknown flag
(`error: unexpected argument '-U' found`, exit 2), not the `--workspace`
value. `getWorkspaceReport` swallows the per-client error and returns `[]`,
so History renders empty with no visible error. Windows keys start with a
drive letter (`C--Users-...`), never `-`, so it was unaffected.

Verified live against this machine's tokscale binary:
- `--workspace <key>` (two tokens) → exit 2, `unexpected argument '-U'`.
- `--workspace=<key>` (one token) → exit 0, returns real session rows.

---

## Implementation Plan

* [x] Pass `--workspace=<key>` as a single argv token in getWorkspaceReport.

---

## Files Modified

- src/main/services/TokscaleService.js

---

## Testing

- `node --test tests/tokscale-service.test.js` passes.
- Direct tokscale invocation with `--workspace=<key>` returns session rows
  for this project on macOS.

---

## Result

Fixed by switching to the `--workspace=<key>` form. History now populates on
macOS/Linux.

---

## Notes

Original ticket 0059 was reverted with no stated reason (batch revert of
0059/0060/0061). The `=`-form fix is re-verified empirically and independent
of whatever motivated the 0060/0061 reverts.

---

## Closed

2026-08-21
