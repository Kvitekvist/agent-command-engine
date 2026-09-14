# Release delivery

Do not publish this audit's unsigned diagnostic package as a signed release.
Signing and clean Windows/macOS installation checks remain required.

## Prepare a release

Close development ACE processes before an in-place `npm ci`: Electron DLLs and
Vite native bindings are locked while running. To keep agents alive, verify the
lockfile in an isolated checkout instead. Stopping only Vite is not sufficient.

1. Make a deliberate version change with `node scripts/bump-version.js`, which
   updates package.json, package-lock.json and version.txt. Review and commit only
   the release's intended changes, with its changelog.
2. Run `node scripts/prepare-release.js <full-reviewed-commit-sha>` from a clean
   tree at that exact commit. It installs the lockfile, tests and packages. It
   never stages, commits, merges, tags or pushes.
3. Tag and push only as explicit release actions. CI tests the tag's commit,
   builds signed Windows/macOS artifacts, verifies signatures, writes SHA-256
   checksums and publishes only after both platforms pass.

## Required CI secrets

Configure `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `MAC_CSC_LINK`,
`MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
`APPLE_TEAM_ID` in the repository's Actions secrets. Certificate links/content
must be protected secrets, never checked into the repository. The workflow
fails closed if signing inputs are absent. The last repository-secret name
check during this audit returned no configured repository secrets; signing was
not exercised. Organization-level availability was not established.

## Manual and offline update

Download the installer matching the machine's platform/architecture, its
`SHA256SUMS-<platform>.txt` and release notes from the same release. Transfer
these together for offline installation. Verify the checksum before opening:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\ACE-installer.exe'
Get-AuthenticodeSignature -LiteralPath '.\ACE-installer.exe'
```

```sh
shasum -a 256 ACE.dmg
codesign --verify --deep --strict '/Applications/Agent Command Engine.app'
spctl --assess --type execute '/Applications/Agent Command Engine.app'
```

Compare the hash with the published value and require a valid expected
publisher signature. A checksum alone does not authenticate its publisher.
Do not remove quarantine or bypass signature warnings on managed machines.
The older convenience install script is not this verified delivery path.

Save files and stop sessions before replacing ACE. Back up `Documents/ACE`
and project files first. Keep the previous installer and pre-update database
backup for rollback; do not assume an older build can read newer database
schemas. CLI installation/authentication and remote provider work still need
their normal network access. No automatic updater or staged rollout is added.
