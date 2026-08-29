# TICKET-0029 — Two external `cmd.exe` console windows briefly popped up and closed

**Status**

Open

**Type**

Bug

**Priority**

Medium

---

**Created**

2026-08-09

---

## Description

Two external `cmd.exe` console windows briefly popped up and closed on
Windows while the app was open and idle (no agents running), roughly once
a minute. Reported by the user as "2 commandline windows open and quickly
close from time to time while the app is open."

---

## Reason

`App.jsx` polls `tokens:getLiveUsage` every 60s (`LIVE_USAGE_POLL_MS`) even
with zero agents running, and that handler calls
`TokscaleService.getQuota()` then `getTodayBreakdown()` — two separate
`tokscale` subprocess invocations per poll, matching the "2 windows,
periodic, even idle" report exactly.

All of this app's own `spawn()`/`fork()` calls (`AgentService`,
`TerminalService`, and `TokscaleService` itself) already pass
`windowsHide: true`, so those were ruled out first (`TerminalService`'s
fork was the TICKET-0027 fix; this is a distinct cause). The actual flash
traced to `node_modules/@tokscale/cli/dist/index.js:207`, inside the
third-party `tokscale` npm package: after our (correctly hidden) spawn
starts its Node shim (`tokscale/bin.js`), that shim resolves the real
native binary (`@tokscale/cli-win32-x64-msvc/bin/tokscale.exe`) and runs
it via its own nested `spawnSync(binary, ..., { stdio: "inherit" })` —
with no `windowsHide`. `windowsHide` only suppresses a console for the
process you directly spawn, not a grandchild process spawned by that
child using its own options, so the *inner* spawn is what actually
flashed a console window on Windows; our own spawn options were never in
a position to prevent it.

Confirmed via a manual round-trip: reverted the fix, ran
`node_modules/@tokscale/cli/dist/index.js`'s inner `spawnSync` call by
hand without `windowsHide`, then with it, isolating the missing flag as
the exact line responsible.

---

## Implementation Plan

* [x] Rule out this app's own spawn/fork call sites (all already pass
      `windowsHide: true`) and dead code (`AgentService.sendPrompt`'s
      headless spawn — unused by the UI since TICKET-0019 — ruled out via
      `grep`, nothing calls `window.cpi.sendPrompt`)
* [x] Trace the actual flash to `@tokscale/cli`'s own nested, un-hidden
      `spawnSync` call (third-party code, not ours)
* [x] Considered `patch-package` to patch `node_modules/@tokscale/cli`
      directly — abandoned: its auto-diff step needs a registry install
      to diff against, which failed in this environment, and a
      hand-written patch file also failed to apply cleanly; also adds an
      extra install-time dependency/postinstall step for a one-line
      third-party fix
* [x] Fixed in our own code instead: on `win32`, `TokscaleService` now
      resolves the platform binary package
      (`@tokscale/cli-win32-{x64,arm64}-msvc`) directly via
      `require.resolve` and spawns `tokscale.exe` itself with
      `windowsHide: true`, skipping the vendor JS shim (and its un-hidden
      nested spawn) entirely. Non-Windows platforms are untouched — still
      go through the shim as before
* [x] Live verification (packaged app): running the actual installed
      build surfaced a second bug in this same fix — the Usage panel
      showed "spawn ...\@tokscale\cli-win32-x64-msvc\bin\tokscale.exe
      ENOENT" instead of data. `resolveWindowsBinary()`'s
      `require.resolve(pkg)` returns the path as it appears inside
      `app.asar` (fine for `fs` reads, which Electron patches to read
      through the archive transparently), but `spawn()` makes a real
      Windows `CreateProcess` call, which cannot launch a binary living
      inside the virtual archive — per Electron's own docs, only
      `execFile` gets asar-aware redirection, not `spawn`. The real
      `tokscale.exe` is correctly unpacked to a sibling
      `app.asar.unpacked` tree by the existing `asarUnpack` config
      (`package.json`), but nothing pointed `spawn` at that copy. Fixed
      by rewriting the resolved path's `app.asar` segment to
      `app.asar.unpacked` before spawning. Dev builds are unaffected
      (path never contains `app.asar`, so the rewrite is a no-op).
* [ ] Live verification: after an app restart (main-process change, not
      picked up by Vite's renderer HMR — see architecture.md's `npm run
      dev` gotcha), leave the app open and idle for a few minutes and
      confirm no console windows appear, and that the Token Usage tab /
      Agents-tab usage bar still show real numbers (packaged build,
      post-ENOENT-fix)

---

## Files Modified

- `src/main/services/TokscaleService.js`

---

## Testing

`npm run build:main` (clean) and `npm test` (11/11 pass, no new coverage
— this is Windows console-window visibility, not something the existing
JS-level tests observe). Directly exercised the real code paths
(`TokscaleService.getQuota()` and `getTodayBreakdown()`, the exact two
calls the 60s poll makes) against this machine's real tokscale data and
confirmed both still return correct JSON through the new direct-binary
path. Visual confirmation that no window flashes requires the live app
running idle — see Implementation Plan.

---

## Result

`TokscaleService.runTokscale` now resolves and spawns the Windows
platform binary package directly (`@tokscale/cli-win32-{x64,arm64}-msvc`)
with `windowsHide: true` instead of going through `tokscale/bin.js`'s JS
shim, whose own nested `spawnSync` call (in the third-party package, not
this repo) never set `windowsHide` and was the actual source of the
console-window flash. Non-Windows platforms still go through the
original shim path unchanged. Verified via a clean `npm run build:main`,
the full automated test suite (11/11 pass), and directly calling both
real call sites (`getQuota`/`getTodayBreakdown`) against live tokscale
data. Live idle-app verification (confirm no more flashes over several
poll cycles) still open.

Follow-up (same day): the packaged app's live verification run hit a
second, separate bug in this fix — `resolveWindowsBinary()` handed
`spawn()` the binary's path as it exists inside `app.asar`, which
Windows can't execute directly (`spawn` isn't asar-aware, unlike
`execFile`). Fixed by redirecting that path to its `app.asar.unpacked`
counterpart (already produced correctly by the existing `asarUnpack`
config) before spawning. Automated tests (4/4 in
`tokscale-service.test.js`) still pass; dev-mode paths are unaffected
since they never contain `app.asar`. Live re-verification in the
packaged app still open.

---

## Notes

Root cause is in a third-party dependency (`@tokscale/cli` 4.9.0), not
this app's own code — worth reporting upstream
(github.com/junhoyeo/tokscale) so a future `tokscale` version fixes it at
the source; the direct-binary workaround here can be reverted once it
does. If `tokscale` changes its platform-package layout in a future
version, `resolveWindowsBinary()`'s `require.resolve` will start failing
closed (falls back to the un-hidden JS-shim path, i.e. the original bug
resurfaces, not a hard crash) — worth a quick check after any `tokscale`
version bump.

---

## Closed

