# TICKET-0148 — Bundle Git and auto-provision prerequisites on setup

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Medium

**Created**

2026-09-14

---

## Description

A fresh machine (confirmed on a clean Hyper-V VM) with none of ACE's
prerequisites on PATH failed every agent launch with "Cannot resolve a
native or npm claude installation," and the Prerequisites checklist required
a manual click per CLI even when a one-shot setup was wanted.

---

## Reason

- `src/resources/mingit` was already fetched and packaged by
  `scripts/fetch-mingit.js` "for users who don't have Git on PATH," but
  nothing in the app ever spawned it — `git:pull` and `prereqs:check` both
  called bare `git`, inheriting `process.env.PATH`.
- `SetupView`/`PrereqChecklist` only installed a prerequisite when a button
  was clicked, and a Node.js install via winget left the already-running
  process's stale `PATH` unable to see it, with no way to recover short of a
  manual restart.
- `prereqs:installNode` treated winget's "already installed, no upgrade
  available" outcome as a failure, which both showed a confusing error and
  skipped the one thing (relaunch) that would have picked up a Node.js
  install already present on the machine.

---

## Implementation Plan

* [x] `GitPath.js` — prepend bundled MinGit's `cmd/` dir to `process.env.PATH`
  once at startup, only when git isn't already resolvable. Every git spawn
  (`git:pull`, `prereqs:check`, and every agent terminal via
  `TerminalService` → `ptyHost`, which both inherit `process.env`) picks it
  up automatically.
* [x] `PrereqChecklist` gets an `autoInstall` prop (SetupView only, not
  Settings' manual re-run): installs each missing piece once — Node first,
  then claude/codex — instead of waiting for a click.
* [x] `prereqs:relaunch` + auto-relaunch after a Node install, gated to the
  `autoInstall` path only (Settings may have live agent terminals open, so it
  keeps the manual "restart ACE" copy).
* [x] Fix `prereqs:installNode`: winget's "already installed, no upgrade"
  outcome now resolves `ok: true` instead of surfacing as an error, so the
  auto-relaunch actually fires when Node.js was already present.
* [x] `scripts/sign-and-install-msix.ps1` — trust the test cert in
  `LocalMachine\Root` as well as `TrustedPeople` (a Hyper-V test VM's chain
  validation needed both), keep the exported `.cer` next to the signed
  `.appx` instead of `$env:TEMP`, and verify the signature actually applied
  (`signtool verify`) before treating a sign as successful — `signtool sign`
  exited 0 once without actually signing anything, and only `verify` caught
  it (`Get-AuthenticodeSignature` reported `NotSigned` either way and proved
  unreliable for the appx SIP in that environment).
* [x] `.claude/skills/msix-sideload-test/SKILL.md` — runbook for the
  build → sign → verify → hand-off-to-another-machine loop, including why
  Developer Mode and `-Register` don't substitute for a real sealed-install
  test, and the `0x800B010A` / `0x800B0100` troubleshooting table.

---

## Files Modified

- `src/main/services/GitPath.js` — new
- `src/main/index.js`
- `src/main/ipc/handlers.js`
- `src/main/preload.js`
- `src/renderer/components/PrereqChecklist.jsx`
- `src/renderer/views/SetupView.jsx`
- `src/renderer/utils/runOperation.js`
- `src/tests/git-path.test.js` — new
- `scripts/sign-and-install-msix.ps1`
- `.claude/skills/msix-sideload-test/SKILL.md` — new

---

## Testing

`npm test` (103 tests, 1 skipped Windows-only case) passes, including the new
`git-path.test.js` covering: git already on PATH (no-op), git missing with a
bundled copy present (prepends it), git missing with no bundled copy
(no-op), and a non-Windows platform (no-op, MinGit isn't bundled there).

Manually verified end-to-end on a clean Windows 10 Enterprise Hyper-V VM:
appx install blocked with `0x800B010A` until the signing cert was trusted in
both `TrustedPeople` and `Root`; a subsequent `0x800B0100` traced to copying
the unsigned build instead of the signed one, resolved by the `signtool
verify` fix. Prereq auto-install/relaunch fix (`prereqs:installNode`
"already installed" case) is implemented and covered by the existing manual
smoke-test flow but not yet re-verified end-to-end on a fresh VM after this
exact change — do that before closing.

---

## Result

A fresh machine with nothing installed gets git for free (bundled), and
Node.js + the CLIs auto-install and self-recover from a Node install via a
managed relaunch, without requiring a click through Setup.

---

## Notes

Node.js itself is still not bundled — Developer Mode's sideload relaxation
does not bypass a sealed package's signature-chain validation, so it was
ruled out as a way to avoid Windows Update/winget entirely; see
`msix-sideload-test`'s "why not Developer Mode" section for the reasoning
that generalizes beyond MSIX to this decision too. Vendoring the Claude/Codex
CLIs themselves (mingit-style) was considered and explicitly declined —
redistributing Anthropic's and OpenAI's CLI packages in ACE's own installer
was judged a decision worth making deliberately rather than defaulting into.

---

## Closed

---
