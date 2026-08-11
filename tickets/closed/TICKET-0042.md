# TICKET-0042

**Status**

Closed

**Type**

Enhancement

**Priority**

Low

**Created**

2026-08-11

---

## Description

The Token Usage dashboard's "Today by project" breakdown (per-provider
`UsageCard`) showed each project by its full tokscale workspace key — the
Claude Code project-dir name, where every path separator is flattened to a
dash (e.g. `C--Users-JensPetterR-yseth-Documents-VS-Code-ACE`). The user only
wants the leaf folder name (`ACE`).

Reduce the displayed label to the last dash-delimited segment while keeping the
full key available on hover (tooltip) and as the aggregation key so two
distinct paths that share a leaf folder name never merge.

---

## Reason

The full dashed path is noise in a compact card and truncates unhelpfully; the
folder name is what identifies the project at a glance.

---

## Implementation Plan

* [x] Add `shortenWorkspace(label)` helper to `TokscaleService` (last
      non-empty dash segment; `'unknown'` fallback)
* [x] `getTodayBreakdown` returns `{ name: <leaf>, fullName: <key>, tokens }`
      per project, still keyed/aggregated by the full key
* [x] `UsageCard` renders `p.name`, uses `p.fullName` for the tooltip and
      React key
* [x] Unit test for `shortenWorkspace`
* [x] Update CHANGELOG, ticket memory

---

## Files Modified

- `src/main/services/TokscaleService.js`
- `src/renderer/components/UsageCard.jsx`
- `src/tests/tokscale-service.test.js`
- `CHANGELOG.md`
- `.claude/memory/ticket_memory.md`

---

## Testing

- `node --test tests/tokscale-service.test.js` → 5 pass, 0 fail (new
  `shortenWorkspace` case included: dashed key → `ACE`, plain name, empty,
  undefined, and trailing-separator all covered)

---

## Result

The "Today by project" card now shows the leaf folder name; hovering still
reveals the full workspace key. A folder name containing dashes can't be
recovered unambiguously from the flattened key, so the leaf segment is
best-effort by design (documented in the helper).

---

## Closed

2026-08-11
