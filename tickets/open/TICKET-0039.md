# TICKET-0039

**Status**

Open

**Type**

Bug

**Priority**

High

**Created**

2026-08-10

---

## Description

Auto-answer permission prompts (TICKET-0038, closed as "fully live-verified")
is still failing live. Screenshot evidence from the user: agent "Talia"
(`claude-sonnet-5`) sitting on an unanswered WebFetch permission prompt for
`www.yr.no` — the exact Ink menu TICKET-0038's `stripAnsi()` +
`/❯\s*1\.\s*Yes\b/i` pattern was built to catch — with no auto-response ever
sent.

---

## Reason

TICKET-0038's own "Important Notes" already documented the gap that explains
this: *"Changing the setting doesn't affect already-running agents... Stop
and relaunch the agent to apply the new setting."* `autoAnswerEnabled` is
read once from `window.cpi.getSetting('auto_accept_permissions')` at
`AgentTerminal.jsx` mount time and baked into the PTY session at spawn —
there is no way to turn it on (or off) for a session that's already running,
and no way to react to a prompt that's already on screen at the moment the
user decides they want it answered.

Separately, the detection path has no self-healing: `ptyHost.js` sends a
single `\r` and clears its buffer. If that keystroke is dropped (ConPTY
timing, CLI mid-render, anything) there's no verification and no retry — the
prompt just sits there identically to "never detected it at all," which is
indistinguishable from the bug in the screenshot from the outside.

Root cause could be either (or both, on different sessions) — the fix
addresses both so neither can reproduce this symptom again.

---

## Implementation Plan

* [x] `ptyHost.js`: always accumulate the rolling output buffer regardless
      of whether auto-answer is enabled for that session, so enabling it
      later can act on a prompt that's already fully rendered
* [x] `ptyHost.js`: add a `setAutoAnswer` command so a live session's
      auto-answer flag can be flipped without a respawn, checking the
      already-buffered output immediately when turned on
* [x] `ptyHost.js`: verify-and-retry after sending `\r` — if the same
      prompt marker is still in the buffer ~600ms later, resend once more
      (bounded, max 2 retries) instead of assuming success
* [x] `TerminalService.js` / `handlers.js` / `preload.js`: wire
      `terminal.setAutoAnswer(id, enabled)` end to end
* [x] `AgentTerminal.jsx`: per-agent live toggle pill (reflects + flips the
      running session's auto-answer state instantly, no relaunch) plus a
      one-click manual "Approve" button as a direct escape hatch
* [x] Update `AUTO_ACCEPT_PERMISSIONS_IMPLEMENTATION.md`
* [x] Build and run the test suite
* [ ] Live end-to-end re-verification in the real app (deferred — no
      isolated live session available in this environment; see Notes)

---

## Files Modified

- `src/main/ptyHost.js`
- `src/main/services/TerminalService.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/AgentTerminal.jsx`
- `AUTO_ACCEPT_PERMISSIONS_IMPLEMENTATION.md`

---

## Testing

- [x] `npm test` (existing suite)
- [x] `npm run build`
- [ ] Live: toggle the new per-agent pill on an already-running agent sitting
      on a real unanswered prompt, confirm it resolves without relaunching
- [ ] Live: click "Approve" manually and confirm it submits "1. Yes"

---

## Result

Implemented all planned changes; `npm run build` and `npm test` (11/11) both
clean. Left **Open** rather than closed, unlike TICKET-0038's premature
close — this environment has no way to attach to a live, already-running
ACE instance (or spawn an interactive terminal session and drive real
keystrokes into it) to reproduce the exact "agent stuck on a real prompt"
scenario end-to-end, and TICKET-0038 already demonstrated what happens when
a fix like this gets marked verified without that step. Live re-verification
is the only remaining item.

The main-process files touched (`ptyHost.js`, `TerminalService.js`,
`handlers.js`, `preload.js`) mean the running app needs a restart to pick
this up — which will also end any currently-running agent terminal sessions
(including the one stuck on the WebFetch prompt in the original report), so
that specific session can't be "healed" in place; relaunching the agent
after the restart starts it on the fixed code path instead.

---

## Notes

This ticket does not dispute that TICKET-0038's detection pattern
(`/❯\s*1\.\s*Yes\b/i` against `stripAnsi()`-reconstructed text) is correct —
that mechanism is left as-is. The fix here is entirely about *when* that
mechanism gets to run (live toggle instead of spawn-time-only) and *what
happens if the response doesn't land* (verify-and-retry + manual override).

---

## Closed

(pending)
