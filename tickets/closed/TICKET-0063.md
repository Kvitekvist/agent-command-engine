# TICKET-0063: Packaged app terminal fails with "posix_spawnp failed"

**Type**: Bug
**Status**: Completed
**Created**: 2026-08-21
**Updated**: 2026-08-21

## Problem

Opening an agent in the packaged macOS app failed immediately with:

```
Failed to start terminal: posix_spawnp failed.
```

The renderer never got a working PTY, so no agent could launch.

## Root Cause

node-pty creates the PTY by `posix_spawn`-ing its bundled `spawn-helper`
executable. The prebuilt binary it ships
(`node_modules/node-pty/prebuilds/darwin-{arm64,x64}/spawn-helper`) has file mode
`0644` — **no executable bit** — and electron-builder's asar packing preserves
that mode. So in the packaged app the helper is present and correctly code-signed
but not executable, and `posix_spawn` fails with `EACCES`, surfaced as
"posix_spawnp failed".

This regressed because the `afterPack` hook that used to restore the exec bit
lived only in the deleted second clone (see TICKET-0062) and was never committed.

Note: the code signature is unaffected by the fix — a Mach-O signature covers
file *contents*, not filesystem mode bits, so `chmod +x` on an already-signed
`spawn-helper` leaves `codesign --verify` passing (confirmed).

## Solution

- **New `src/build/afterPack.js`** — recursively finds every `spawn-helper` under
  the packed `appOutDir` and `chmod 0o755`s it. `afterPack` runs after packing
  but before signing, so the shipped signed binary is both executable and signed.
  Idempotent; a no-op on Windows (no spawn-helper).
- **`src/package.json`** — register `build.afterPack: "build/afterPack.js"`.

## Files Changed

- `src/build/afterPack.js` (new)
- `src/package.json` — `build.afterPack`

## Testing

- [x] Reproduced: installed app's `spawn-helper` was `0644`; terminal failed
- [x] Immediate fix on the installed app: `chmod +x` both arch helpers →
      `codesign --verify --strict` still passes
- [x] `npm run package` with the hook → packaged `spawn-helper` is `0755`
      without any manual step, signature valid
- [ ] Interactive confirmation that an agent terminal starts in the rebuilt app

## Note

Part of the same fallout as TICKET-0062: build-time setup that existed only as
uncommitted changes in a deleted clone. Now in version control so a clean-clone
`npm run package` produces a working terminal.
