# TICKET-0157 — MSIX AppData virtualization hides npm-installed CLIs from agent terminals

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-27

---

## Description

On a clean machine with the AppX build, New Agent failed with
"claude.exe is not recognized" / "Cannot find module ...codex.js". ACE's
`npm install -g` wrote `%APPDATA%\npm` into the package's virtualized
LocalCache, so ACE's own existence check passed but the agent PowerShell saw
the real `%APPDATA%`, where nothing was installed.

---

## Reason

The AppX build could not launch agents on any machine without a prior
non-packaged CLI install.

---

## Implementation Plan

* [x] `build-msix.js` manifest patch: `desktop6:FileSystemWriteVirtualization`
  and `RegistryWriteVirtualization` disabled, `rescap:unvirtualizedResources`
  capability, fail the build if the patch doesn't apply.
* [x] Raise MinVersion to 10.0.19041.0 (desktop6 floor).

---

## Files Modified

- `scripts/build-msix.js`

---

## Testing

- `makeappx pack` accepted the patched manifest; manifest inspected in the built appx.
- v0.1.38 AppX on a clean Hyper-V VM: CLIs install to the real `%APPDATA%\npm`
  and agents launch (confirmed by the user).

---

## Result

Fixed in v0.1.38. Partner Center will ask for a justification of
`unvirtualizedResources` on Store submission.

---

## Notes

Installs made by earlier AppX builds stay in the old LocalCache; reinstall
the CLIs from Setup after upgrading.

---

## Closed

2026-09-27
