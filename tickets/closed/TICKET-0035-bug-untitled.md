# TICKET-0035

**Status**

Closed

**Type**

Bug

**Priority**

Low

**Created**

2026-08-09

---

## Description

Standardize every rounded-corner box in the UI to a consistent, subtle 3px
radius. User feedback: the app currently mixes several different Tailwind
radius scales (`rounded` = 4px, `rounded-lg` = 8px) across cards, buttons,
inputs, and panels, which reads as visually inconsistent ("too many edge
corners").

Fully-round pill/circle shapes (`rounded-full` — toggle switches, progress
bar tracks/fills in UsageBar.jsx/UsageCard.jsx/SettingsView.jsx) are excluded
by design: those are meant to be capsule/circular shapes, not "cornered"
boxes, and forcing them to 3px would flatten a toggle switch into a
rounded rectangle instead of a pill.

---

## Reason

Direct user feedback: "i dont like all the edge courners in the app. any
rounded courner should be 3pxl".

---

## Implementation Plan

* [ ] Override Tailwind's `borderRadius` theme in `src/tailwind.config.js`
      so `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`
      all resolve to 3px — single source of truth instead of hunting down
      every class usage individually
* [ ] Leave `rounded-full` untouched (pill/circle shapes)
* [x] Verify no component relies on a larger radius for a reason the 3px
      override would break

---

## Files Modified

- src/tailwind.config.js

---

## Testing

`npm run build:renderer` (clean build confirms Tailwind config is valid).

---

## Result

Implemented as planned. Overrode `borderRadius.DEFAULT/md/lg/xl/2xl` to
`3px` in `src/tailwind.config.js`, leaving `rounded-full` (toggle
switches, progress bar tracks/fills) untouched. Checked every `rounded-lg`
usage in the renderer (`SettingsView.jsx`'s advisor-suggestion cards,
`globals.css`'s `.card` component) — both are plain decorative cards, not
pills/circles, so the 3px override is a pure visual tightening with no
functional dependency broken. Verified via a clean
`npm run build:renderer`.

---

## Notes

---

## Closed

2026-08-09
