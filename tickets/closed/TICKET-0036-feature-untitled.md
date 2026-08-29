# TICKET-0036

**Status**

Closed

**Type**

Enhancement

**Priority**

Low

**Created**

2026-08-09

---

## Description

Add screenshots to the README (agent interface + usage dashboard) and credit
the third-party project the token usage tracking code was derived from.

---

## Reason

User request: showcase the app in the README and give credit to
[token-monitor](https://github.com/Javis603/token-monitor), the upstream
project the token usage tracking code was built on.

---

## Implementation Plan

* [x] Copy the two screenshots out of `.cpi/screenshots/` (gitignored, not
      trackable) into a new tracked `docs/screenshots/` folder
* [x] Add a Screenshots section to README.md, agent interface first (the
      more interesting/primary view), usage dashboard second
* [x] Add a Credits section linking to token-monitor and its author

---

## Files Modified

- README.md
- docs/screenshots/agent-interface.png (new)
- docs/screenshots/usage.png (new)

---

## Testing

Visual check of rendered README.md locally; confirmed image paths resolve
relative to repo root so they render on GitHub once pushed.

---

## Result

Added "Screenshots" section (agent interface, then usage) and a "Credits"
section crediting Javis603/token-monitor to README.md. Screenshots copied
from the gitignored `.cpi/screenshots/` folder into tracked
`docs/screenshots/` so they actually render on GitHub.

---

## Notes

---

## Closed

2026-08-09
