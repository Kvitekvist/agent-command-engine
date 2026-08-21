# TICKET-0059: Token Usage History Empty on macOS/Linux Due to tokscale Arg Parsing

**Type**: Bug  
**Status**: Completed  
**Created**: 2026-08-21  
**Updated**: 2026-08-21

## Problem

The Token Usage view's "History (this project)" section always showed "No recorded
usage for this project yet" on macOS (and would also affect Linux), even though
Claude/Codex sessions for the project existed.

## Root Cause

`TokscaleService.getWorkspaceReport` invoked tokscale as:

```
report --json --no-summarize --workspace <key> --client <client>
```

`pathToWorkspaceKey` flattens every non-alphanumeric character in the project's
filesystem path to a dash. On macOS/Linux, paths start with `/`, so every
workspace key starts with `-` (e.g. `-Users-jane-Documents-...`). tokscale's CLI
argument parser treats a value starting with `-` passed as a separate token as an
unrecognized flag rather than the `--workspace` value, failing with
`error: unexpected argument '-U' found` (exit code 2). `getWorkspaceReport`
swallows this per-client error and returns an empty array, so the History section
rendered as empty with no visible error.

This did not affect Windows, where paths start with a drive letter (e.g. `C--Users-...`),
so the workspace key never begins with `-`.

## Solution

Pass the workspace key using `--workspace=<value>` (single token) instead of
`--workspace <value>` (two tokens). The `=` form is unambiguous to tokscale's
parser regardless of what the value starts with.

## Files Changed

- `src/main/services/TokscaleService.js`
  - `getWorkspaceReport`: changed `'--workspace', workspaceKey` to
    `` `--workspace=${workspaceKey}` ``

## Testing

- [x] Verified locally by invoking tokscale's packaged binary directly with both
      arg forms: `--workspace <value>` reproduces the exit-2 parsing failure,
      `--workspace=<value>` succeeds and returns session rows.
- [x] `node --test tests/tokscale-service.test.js` — 6/6 pass
- [ ] Live verification in the running Electron app (rebuild required — the
      user's installed app in `~/Downloads/agent-command-engine/releases` predates
      this fix and TICKET-0058)

## Note

The user also observed "Quota unavailable — tokscale exited with code 1" (empty
stderr/stdout) for the live quota/today-breakdown cards. This did not reproduce
under manual invocation (`tokscale usage --json` returned exit 0 each time tried)
and may be transient at app startup. No code fix applied for that symptom; monitor
after the rebuild and revisit if it recurs with the workspace-report bug fixed.
