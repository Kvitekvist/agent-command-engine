# TICKET-0094 — Generate images from Codex agent cards

**Status**

Closed

Closed

**Type**

Feature

**Priority**

Medium

**Created**

2026-08-22

---

## Description

Add a Codex-only ImageGen action to each running ACE agent card. It should send
an explicit image-generation request to the agent's authenticated interactive
Codex CLI session, so it uses Codex's built-in image-generation capability
without an ACE-managed OpenAI API key or an image model in the coding-model
dropdown.

---

## Reason

Users can generate images from the installed Codex app and need the same
capability in the Codex sessions launched by ACE.

---

## Implementation Plan

* [x] Verify that the locally installed Codex CLI exposes enabled image
      generation and that its system ImageGen skill is available.
* [x] Add a tested pure helper that builds a bounded, explicit ImageGen prompt
      and instructs Codex to save the result under `.ace/generated-images/`.
* [x] Add a Codex-only ImageGen control to the live terminal toolbar which
      gathers the image brief and writes the helper prompt to that session.
* [x] Build and run the test suite; record results and manual verification
      steps.

---

## Files Modified

* `tickets/open/TICKET-0094.md`
* `src/renderer/components/AgentTerminal.jsx`
* `src/renderer/utils/imageGenerationPrompt.mjs`
* `src/tests/image-generation-prompt.test.js`

---

## Testing

* [x] `npm test` — 68 passed, 1 skipped (Windows POSIX-only permission test)
* [x] `npm run build`
* [ ] Manual: create an image from a running Codex card and confirm the
      generated project file and displayed Codex response.

---

## Result

Implemented the Codex-only ImageGen action. It collects an image brief and
writes a single-line ImageGen request into the running authenticated Codex
session, directing generated files to `.ace/generated-images/`. No API key or
model change is involved. Pending a live account-backed manual verification.

---

## Notes

Local verification: `codex-cli 0.149.0` reports `image_generation` as stable
and enabled, and `%USERPROFILE%/.codex/skills/.system/imagegen` is present.

---

## Closed

2026-08-29
