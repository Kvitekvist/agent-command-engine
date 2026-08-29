# TICKET-0056: Fix `npm run package` crash during update-info generation

**Status:** Closed
**Priority:** High
**Created:** 2026-08-17
**Closed:** 2026-08-17

---

## Issue

Found live while cutting the v0.1.8 release: `npm run package` (via
`scripts/release.bat`) built both the portable exe and the NSIS installer
successfully, then crashed at the very end with:

```
Cannot read properties of null (reading 'provider')
  at createUpdateInfoTasks (app-builder-lib/src/publish/updateInfoBuilder.ts:133:64)
```

preceded by repeated `Cannot detect repository by .git/config. Please
specify "repository" in the package.json` warnings. `release.bat` treats any
non-zero exit from `npm run package` as fatal and aborts before commit/push/
tag/publish, so this blocked the whole release pipeline even though the
actual installer artifacts were already sitting in `releases/`.

Root cause: `src/package.json`'s electron-builder `build` config has no
`publish` key, so electron-builder tries to auto-detect a publish provider
(for generating `latest.yml`/blockmap update metadata) from `repository` in
package.json or the git remote — neither resolves cleanly here, and
electron-builder's own `createUpdateInfoTasks` doesn't handle that null case,
crashing instead of just skipping. ACE doesn't use Electron's built-in
auto-updater anywhere (`electron-updater` isn't even a dependency; releases
are published manually to GitHub via `release.bat`'s own `gh release create`/
`upload`), so this update-metadata generation step is pure dead weight that
happened to start crashing.

---

## Fix

Added `"publish": null` to `src/package.json`'s `build` config — the
documented electron-builder way to fully disable publish-provider detection
and update-metadata generation. Confirmed this is safe: no code anywhere
references `electron-updater`, `autoUpdater`, `latest.yml`, or `blockmap`.

---

## Testing

* [x] `npm run package` completes with exit code 0, no crash, no more
      "Cannot detect repository" warnings
* [x] Portable exe + NSIS installer for 0.1.8 both present in `releases/`
      with fresh timestamps
* [x] `npm test` still 13/13

---

## Result

Live-verified: re-ran `npm run package` after the fix, completed cleanly
(portable + NSIS installer built, block map generated, `win-unpacked` →
`Portable-ACE` rename succeeded, no error). Rolled into the same v0.1.8
release this was found while cutting.
