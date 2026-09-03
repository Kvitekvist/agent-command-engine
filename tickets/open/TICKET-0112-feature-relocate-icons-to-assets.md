# TICKET-0112 — Relocate icons to assets

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

Move icon files from `build/` to `assets/icons/` to better align with project structure where `build/` is for build outputs and `assets/` is for source assets.

---

## Reason

The `build/` directory should contain only generated outputs, not source assets. Icons are source files that get packaged, so they belong in `assets/icons/`.

---

## Implementation Plan

* [x] Create `assets/icons/` directory
* [x] Move all icon files from `build/` to `assets/icons/`
* [x] Update all references in documentation (ICONS.md)
* [x] Update all references in scripts (create-icons.py, create-icns.js, create-icns-on-mac.sh)
* [x] Update all references in source code (index.js, FileService.js, FileTree.jsx)
* [x] Update package.json build configuration
* [x] Update .gitignore to exclude screenshots directory
* [x] Bump version to 0.1.29

---

## Files Modified

- `.gitignore` — Remove build directory exclusions
- `build/` → `assets/icons/` — All icon files and README moved
- `docs/ICONS.md` — Update all path references
- `scripts/create-icns-on-mac.sh` — Update icon paths
- `scripts/create-icns.js` — Update icon paths
- `scripts/create-icons.py` — Update icon paths
- `src/main/index.js` — Update icon path resolution
- `src/main/services/FileService.js` — Update icon paths
- `src/package.json` — Update build configuration paths
- `src/renderer/components/FileTree.jsx` — Update icon paths
- `version.txt` — Bump to 0.1.29

---

## Testing

```bash
# Verify scripts still work
python scripts/create-icons.py

# Verify electron build configuration
npm run package
```

---

## Result

All icon files successfully moved to `assets/icons/` with all references updated. Build and packaging configurations point to new location.

---

## Notes

The untracked `assets/images/screenshots/` directory was left uncommitted as it's not part of this icon relocation work.

---

## Closed

YYYY-MM-DD
