# TICKET-0161 — Renderer smoke test fails on all CI platforms since v0.1.39

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-28

---

## Description

`Tests` failed on ubuntu, macOS and Windows for the v0.1.39 and v0.1.40
pushes at `scripts/smoke-renderer.js`: "Missing renderer state: ...'Smoke
project'". Two causes, both in the smoke harness rather than the app:

1. TICKET-0155's `watchUsageActivity` subscribes to `window.ace.terminal.onData`,
   `terminal.onExit` and `onAgentActivity`. The smoke preload stubbed none of
   them, so App threw on mount and rendered nothing.
2. TICKET-0156's launch-bar "🔄 Models" button stays mounted behind Settings,
   so the substring `click('Models')` hit it instead of the Settings tab, and
   "Save Model Visibility" was never clicked.

---

## Reason

CI was red on every platform, hiding any real regression.

---

## Implementation Plan

* [x] Stub `terminal.onData`, `terminal.onExit` and `onAgentActivity` in
  `smoke-renderer-preload.js`.
* [x] Click the Settings "Models" tab by exact label and wait for its content.

---

## Files Modified

- `src/scripts/smoke-renderer-preload.js`
- `src/scripts/smoke-renderer.js`

---

## Testing

- Local Windows: `smoke-renderer.js` passes, `smoke-main.js` exits 0,
  `scripts/run_tests.sh` passes.
- CI `Tests` run 36390242552: ubuntu, macOS and Windows all green.

---

## Result

CI green again on all three platforms.

---

## Notes

The `Release` workflow still fails at "Require release signing credentials"
on every tag; that is the missing signing secrets, not code.

---

## Closed

2026-09-28
