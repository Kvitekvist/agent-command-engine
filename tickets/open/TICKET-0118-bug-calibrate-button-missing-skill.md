# TICKET-0118 — Calibrate quick-action fails on the ACE repo itself

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Low

**Created**

2026-09-03

---

## Description

The agent terminal's **Calibrate** button (`AgentTerminal.jsx:438`) types
`/calibrate-enhanced`. That skill ships only in the project scaffold
(`src/main/project-template/.claude/skills/calibrate-enhanced/`), not in ACE's
own `.claude/skills/`, so running it on the ACE repo returns
"Unknown command: /calibrate-enhanced".

Scaffolded projects are fine — they get the skill from the template.

---

## Reason

ACE's `.claude/skills/` had only `build-node-map`, `node-map`, `push-update`.
The three quick-action commands are `/push-update` (present), `/clear`
(built-in), and `/calibrate-enhanced` (missing here).

---

## Implementation Plan

* [x] Copy `calibrate-enhanced/SKILL.md` from the template into
  `.claude/skills/` (self-contained, one file, no template-specific paths)
* [ ] Run the Calibrate button on an ACE agent and confirm the skill loads

---

## Files Modified

- `.claude/skills/calibrate-enhanced/SKILL.md` — new (copy of the template's)

---

## Testing

Diffed the copy against the template source — identical. Not yet run via the
button.

---

## Result

`/calibrate-enhanced` resolves when working on ACE itself, matching every
project ACE scaffolds.

---

## Notes

The other two quick-actions already resolve on ACE (`/push-update` skill,
`/clear` built-in). No other ACE UI or doc points at a skill ACE lacks.

If the template's `calibrate-enhanced` changes later, this copy has to be
updated by hand — same manual-sync caveat as any vendored file.

---

## Closed

---
