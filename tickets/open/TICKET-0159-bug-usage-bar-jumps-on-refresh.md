# TICKET-0159 — Usage bar disappears during refresh and shifts the window

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-27

---

## Description

Every usage refresh unmounted the top usage bar (`if (liveUsageLoading) return
null`), so the whole window jumped up and back down. TICKET-0155's
activity-driven refresh made it frequent. The Token Usage tab swapped its
cards for "Loading live usage…" the same way.

---

## Reason

Visible layout jump on every agent turn.

---

## Implementation Plan

* [x] Store: `liveUsageLoaded` flag set after the first load; the last known
  `liveUsage` is kept during refreshes (already the case).
* [x] UsageBar always renders with a minimum height; "loading…" only before
  the first load.
* [x] TokenView shows its loading text only before the first load.

---

## Files Modified

- `src/renderer/store/useStore.js`
- `src/renderer/components/UsageBar.jsx`
- `src/renderer/views/TokenView.jsx`

---

## Testing

- `cd src && npm test`: 135 pass; renderer build clean.
- Live check of a refresh in v0.1.39 still pending.

---

## Result

Shipped in v0.1.39.

---

## Notes

---

## Closed
