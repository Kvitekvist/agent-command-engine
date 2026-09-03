# TICKET-0123 — Store-listing image sizes

**Status**

Awaiting verification

**Type**

Feature

**Priority**

Low

**Created**

2026-09-03

---

## Description

Partner Center's Store listing needs image assets separate from the MSIX
tiles in `src/build/appx/`. Add the sizes requested for the ACE listing.

---

## Files Modified

- `assets/images/store/StoreLogo-300x300.png` (new) — Store logo
- `assets/images/store/Square-150x150.png` (new)
- `assets/images/store/Square-71x71.png` (new)
- `assets/images/store/Poster-1440x2160.png` (new) — glyph centered on the
  `#2b2b2b` brand background, 2:3 portrait

---

## Testing

Generated from `assets/icons/icon.iconset/icon_1024x1024.png` with ffmpeg
(lanczos). Dimensions verified with `file`.

---

## Result

Listing images ready to upload alongside the 0.1.31 package.

---

## Notes

Squares keep the icon's transparency; composite on whatever background the
Store page uses. Ask for solid-background variants if the transparent Store
logo reads poorly.

---

## Closed

---
