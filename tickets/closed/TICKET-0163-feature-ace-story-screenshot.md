# TICKET-0163 — Storytelling screenshot of ACE

**Status**

Closed

**Type**

Feature

**Priority**

Low

**Created**

2026-09-29

---

## Description

One tall image that walks through a single task in ACE, for sharing in
Slack: setup, the first-prompt questionnaire, a live agent, the editor,
skills and memories, usage history, and Prompt Score.

---

## Reason

The README screenshots show single views; there was no one image that
shows how the pieces fit together.

---

## Implementation Plan

* [x] Capture each view from a live ACE (v0.1.41, dev build) over the
  Chrome DevTools Protocol at 1440x900, 2x.
* [x] Compose the shots with captions in HTML and render one PNG with
  headless Edge (2400x10623).
* [x] Add it to `docs/screenshots/`.

---

## Files Modified

- `docs/screenshots/ace-story.png`

---

## Testing

Opened the PNG and checked every panel renders and nothing sensitive
(keys, tokens) is visible. It does show project names, spend and plan
usage from the author's machine.

---

## Result

`docs/screenshots/ace-story.png` added. Not linked from the README.

---

## Notes

Capture scripts were one-off and are not committed.

---

## Closed

2026-09-29
