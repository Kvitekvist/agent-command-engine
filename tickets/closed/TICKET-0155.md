# TICKET-0155: Refresh usage on agent activity instead of idle polling

**Status**: Closed
**Type**: Bug
**Priority**: Medium
**Created**: 2026-09-25

## Description

The user reports two brief console windows while ACE is open and requests
usage updates tied to messages instead of periodic background checks.
The historical TICKET-0029 identified the tokscale wrapper as a source of
console flashes. Its unsafe fallback is still present, although the current
reported windows have not been traced to a specific process.

## Implementation Plan

- [x] Replace the App's 60-second usage interval with a shared debounced refresh
  after terminal output/activity, including completion and exit. Keep initial
  loading and the explicit Refresh button.
- [x] Coalesce simultaneous refresh requests so multiple agents do not start
  overlapping usage subprocesses; retain a refresh requested during a fetch.
- [x] Remove the tokscale wrapper fallback, using only the bundled native
  executable with hidden windows. Report a missing native package as an error.
- [x] Test idle silence, activity bursts, completion, cleanup, concurrent refresh
  requests, native launch and missing-binary behavior; run the full tests/build.

## Files Modified

- `src/renderer/App.jsx`
- `src/renderer/utils/usageActivity.mjs`
- `src/renderer/store/useStore.js`
- `src/renderer/views/TokenView.jsx`
- `src/renderer/components/UsageBar.jsx`
- `src/main/services/TokscaleService.js`
- `src/tests/usage-activity.test.js`
- `src/tests/editor-store.test.js`
- `src/tests/tokscale-service.test.js`
- `docs/agents/architecture-guide.md`
- `CHANGELOG.md`

## Testing

- Full suite: 133 passed, 1 platform-specific skip; production build passed.
- Timer check simulates five idle minutes without another usage request,
  combines activity across agents, refreshes on exit, and cancels subscriptions
  and pending timers on cleanup.
- Store check verifies one in-flight fetch, one queued follow-up, error handling
  and recovery. Native-launch check verifies windowsHide, no shell, and no
  subprocess fallback when the native package is missing.
- Real hidden Electron smoke passed startup, IPC and native PTY
  launch/reload/reconnect/stop. Its teardown printed node-pty's AttachConsole
  diagnostic despite successful assertions and exit 0.
- The user's exact transient windows were not traced or visually reproduced;
  this verifies the requested scheduling change and removes the known unsafe
  fallback, not every possible console source in provider/dependency code.

## Result

Usage loads at startup and after three seconds without further terminal output
or activity events. Idle minute polling is gone. Manual Refresh remains for
external sessions or delayed provider quota updates. Native usage subprocesses
remain, but the CMD/Node wrapper fallback is removed. The existing AppX artifact
has not been rebuilt with this follow-up; these changes are in source/build output.

## Closed

2026-09-25

