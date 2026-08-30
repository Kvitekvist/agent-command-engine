# TICKET-0075 — Create a shared IPC contract for channel names and payload boundaries

**Status**

Closed

**Type**

Refactor

**Priority**

High

**Created**

2026-08-22

---

## Description

Create a shared IPC contract for channel names and payload boundaries.

## Reason

IPC strings and request shapes are duplicated across main-process handlers, preload, and renderer code.

## Implementation Plan

Done: only the security half. The channel-constants / payload-schema
refactor was dropped as churn — ~40 channels in a single small app, each
string written twice; a typo fails loudly and immediately. Not worth a
shared module + "contract regression tests".

* [ ] ~~Define shared channel constants and payload conventions~~ — skipped
* [ ] ~~Adopt the contract in handlers and preload~~ — skipped
* [ ] ~~Add contract-level regression tests~~ — skipped
* [x] Validate IPC senders and reject malformed payloads
* [x] Resolve project-scoped authority in main instead of trusting
      renderer-supplied roots

## Files Modified

- `src/main/ipc/handlers.js` — added `resolveProjectRoot(DB, candidate)`
  (matches a renderer-supplied path against `DB.getProjects()`, returns the
  canonical stored path, throws otherwise) and `assertAppSender(event)`
  (rejects any sender that isn't a top-level app frame). Every
  `ipcMain.handle` / `ipcMain.on` now goes through `handle` / `on` wrappers
  that run the sender check. All path-taking handlers — `fs:*`,
  `screenshots:captureRegion`, `git:commitAndPush`, `git:pull`,
  `project:build`, `agents:start`, `agents:restore`, `agents:generateTitle`,
  `tokens:getProjectHistory` — resolve the path through `resolveProjectRoot`
  and operate on the returned value
- `src/main/services/FileService.js` — doc comment updated
- `src/tests/ipc-guards.test.js` — new

## Testing

* [x] `npm test` — 65 passed, 1 skipped (POSIX-only), 0 failed
* [x] `npm run build` — clean

## Result

A compromised or misbehaving renderer can no longer point ACE's filesystem,
git, build, screenshot, or agent-spawn operations at an arbitrary path:
main only acts on directories it has registered as projects, and hands its
own canonical path string to the service rather than the renderer's.
Non-top-frame IPC senders (an injected iframe/webview) are rejected before
any handler runs.

The channel-constants refactor (Part A of the original ticket) was
deliberately not done — see Implementation Plan. If TICKET-0085 (Electron
upgrade / renderer hardening) wants typed payload validation it can build on
`assertAppSender`.

## Notes

---

## Closed

2026-08-30
