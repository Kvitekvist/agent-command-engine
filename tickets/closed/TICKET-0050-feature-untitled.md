# TICKET-0050: Progress + Success/Fail Feedback for Terminal Git/Build Actions

**Status**

Closed

**Type**

Enhancement

**Priority**

Medium

**Created**

2026-08-14

---

## Description

The agent terminal's quick-action buttons (TICKET-0049) run git operations
directly via IPC (Commit & Push, Pull) but give the user no visible feedback —
results only went to the dev console. Add:

* An in-progress (indeterminate) progress bar while each operation runs.
* A clear success / failure message after it completes.
* A **Build** button, which was missing from the UI even though the
  build-capability check (`canBuild`) already existed. It should be visible for
  buildable projects (e.g. ACE itself).

Applies to: **Commit & Push**, **Pull**, and **Build**.

---

## Reason

Direct (no-AI) git/build actions are fire-and-forget with no signal to the user
whether they succeeded, failed, or are still running. A push/pull/build can take
seconds to minutes; the user needs to see progress and the outcome.

---

## Implementation Plan

* [x] Add `project:build` IPC handler (runs `npm run build`, falling back to
      `package`) resolving `{ ok, message }` / `{ ok:false, error }`.
* [x] Expose it in `preload.js` as `window.cpi.project.build(projectPath)`.
* [x] Add an indeterminate progress-bar animation to `globals.css`.
* [x] Wire the existing `commitPushStatus` / `pullStatus` / `buildStatus` state
      in `AgentTerminal.jsx` to a shared feedback component (loading bar →
      success/error line, auto-clearing success), disable buttons while running.
* [x] Render a **Build** button gated on `canBuild`.

---

## Files Modified

* `src/main/ipc/handlers.js`
* `src/main/preload.js`
* `src/renderer/styles/globals.css`
* `src/renderer/components/AgentTerminal.jsx`

---

## Testing

* [x] `npm run build` clean
* [x] `npm test` passes (13/13)
* [ ] Live: Commit & Push shows progress then success/fail
* [ ] Live: Pull shows progress then success/fail
* [ ] Live: Build button visible for ACE, shows progress then success/fail

---

## Result

Implemented. `handlers.js` gained a `project:build` handler that locates the
buildable `package.json` (ACE's lives under `src/`, so a plain project-root
check would miss it), runs `npm run build` (falling back to `package`), and
returns a single settled result with the last few lines of npm output on
failure. `preload.js` exposes it as `window.cpi.project.build`. `globals.css`
gained a `.progress-indeterminate` sliding-highlight animation.
`AgentTerminal.jsx` now has a shared `runOperation()` helper driving each
button's status through loading → success/error, an `OperationFeedback` strip
per action (animated bar while running, coloured ✓/✗ line after), buttons
disabled while their op runs, and a `🔨 Build` button gated on the pre-existing
`canBuild` check. Build clean, tests 13/13. Live verification (real
push/pull/build in the running app) still open — the Build button was confirmed
at the code level to render for ACE (ACE's `src/package.json` has
`build.win`/`build.mac` + `scripts.package`, which `canBuild` requires).

---

## Notes

The progress bar is deliberately **indeterminate** (animated, not percentage-
based): npm/git output doesn't yield reliable progress percentages, so an
animated bar during the operation plus a definitive success/fail line is the
honest representation.

---

## Closed

2026-08-29
