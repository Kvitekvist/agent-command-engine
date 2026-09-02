# TICKET-0108 — Add writing-quality guidance to AGENTS.md

**Status**

Closed

**Type**

Feature

**Priority**

Low

**Created**

2026-09-02

---

## Description

Add a `## Writing` section to `AGENTS.md` so every agent working in ACE
self-edits user-facing prose (PR descriptions, commit bodies, ticket Result
sections, doc changes, longer chat replies) to avoid machine-generated tells.

The rules are inline and self-contained — no skill install or vendored
dependency — so they apply to any provider on a fresh clone. The section
points to the external `avoid-ai-writing` skill as optional deeper tooling
for deliberate audits.

---

## Reason

Agent-authored text across the repo (PRs, tickets, docs) tends toward AI-isms:
significance inflation, copula avoidance, rule-of-three padding, promotional
adjectives. A short standing rule in the provider-neutral entry point fixes
this once for every agent instead of per-session.

---

## Implementation Plan

* [x] Add `## Writing` section to `AGENTS.md` between Working rules and Validation

* [x] Keep rules inline and self-contained; link the external skill as optional

* [x] No repo dependency on the per-user skill install

* [x] Add the Humanizer-based rule against em and en dashes in repository prose.

---

## Files Modified

* `AGENTS.md` updates the writing guidance with the Humanizer dash rule.

- `AGENTS.md` — new `## Writing` section

---

## Testing

Docs-only change. No build or test impact. `AGENTS.md` renders as valid
Markdown; section placement verified between `## Working rules` and
`## Validation`.

---

## Result

`AGENTS.md` now carries writing-quality guidance that ships with the repo and
applies to every agent without setup.

It now prohibits em and en dashes in repository prose and links to Humanizer
for deliberate audits.

---

## Notes

Option 2 of the discussed approaches: inline checked-in guidance rather than
vendoring the full `avoid-ai-writing` skill folder into `.claude/skills/`.

---

## Closed

2026-09-02
