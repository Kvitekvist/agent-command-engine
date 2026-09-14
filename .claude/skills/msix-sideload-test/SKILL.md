---
name: msix-sideload-test
description: Build, sign, verify, and hand off ACE's .appx to another machine (e.g. a Hyper-V test VM) for a real sealed-package install test -- not the loose/unpacked -Register shortcut, the actual signed-install path an end user would go through. Use when the user wants to test the MSIX/appx installer on a VM or another PC, mentions "sideload", "appx install test", or hits 0x800B010A / 0x800B0100 installing a .appx.
---

# msix-sideload-test

Repeatable loop for testing ACE's real MSIX install experience on a separate
machine. Built from a session where the naive version of this (Developer
Mode, loose `-Register`, skipping verification) all turned out to be dead
ends for testing the *actual sealed-package install path*.

## Why not just enable Developer Mode / use `-Register`?

Both bypass exactly what this is meant to test:

- **Developer Mode** relaxes the "must come from the Store" gate, but a
  *sealed* `.appx`'s embedded signature still gets chain-validated regardless
  of Developer Mode. It does not fix `0x800B010A`.
- **`Add-AppxPackage -Register <manifest>`** installs loose, unpacked files
  with no signature check at all -- fast for dev-loop debugging, but it is
  not the install path a real user goes through, so it doesn't test what
  sideload-test is for.

The only thing that actually tests the sealed-install path is a genuinely
signed `.appx` plus that signing cert trusted on the target machine.

## On the host: build + sign + verify

```
node scripts/build-msix.js
powershell -ExecutionPolicy Bypass -File scripts\sign-and-install-msix.ps1
```

Run the second command from an **elevated** PowerShell/cmd. It rebuilds
nothing itself -- always run `build-msix.js` first for a fresh package. It:

1. Finds the newest unsigned `releases\*.appx`.
2. Creates/reuses a persistent test cert (`CN=` matches `src/package.json`'s
   `build.appx.publisher`) and trusts it in this machine's
   `LocalMachine\TrustedPeople` **and** `Root` (some Windows builds' chain
   validation wants the self-signed leaf in Root specifically, not just
   TrustedPeople -- confirmed on a Windows 10 Enterprise Hyper-V VM).
3. Copies + signs into `releases\sideload\<name>.appx`, exports the cert
   next to it as `releases\sideload\ace-test-cert.cer`.
4. **Verifies the signature actually applied** (`signtool verify /pa`) and
   throws if not, installs locally, and re-checks with `Get-AppxPackage`.

That verify step exists because `signtool sign` can exit 0 without actually
signing anything -- happened once mid-session, produced a byte-identical
"signed" copy that was still plain unsigned, and only `signtool verify` (not
`Get-AuthenticodeSignature`, which reported `NotSigned` on files either way
and turned out unreliable for the appx SIP in this environment) caught it.
Never hand off a file this script didn't run verify against successfully.

## Moving it to the target machine

Copy both files from `releases\sideload\`:

- `<Agent Command Engine version>.appx`
- `ace-test-cert.cer`

Hyper-V Enhanced Session drive redirection shows host drives as e.g. "D on
BABYDRAGON" in Explorer, but that's cosmetic -- the real path inside the VM
is a UNC path, `\\tsclient\D\...`. `cmd.exe` cannot `cd` into a UNC path at
all (PowerShell can); simplest is to just copy the two files to `C:\` on the
guest and work from there.

## On the target machine (first time only): trust the cert

Elevated PowerShell or cmd:

```
powershell -NoProfile -Command "Import-Certificate -FilePath 'C:\ace-test-cert.cer' -CertStoreLocation Cert:\LocalMachine\TrustedPeople; Import-Certificate -FilePath 'C:\ace-test-cert.cer' -CertStoreLocation Cert:\LocalMachine\Root"
```

Skip this on a machine that already trusts this cert from a previous round
-- the thumbprint (and thus trust) is stable across versions, only the
`.appx` changes build to build.

## On the target machine (every time): install

```
Add-AppxPackage -Path "C:\Agent Command Engine <version>.appx"
```

## If it still fails

- **`0x800B010A`** (publisher cert could not be verified) -- cert isn't
  trusted on *this* machine yet, or trusted only in `TrustedPeople` and this
  Windows build wants `Root` too. Re-run the Import-Certificate step above
  with both stores.
- **`0x800B0100`** (no signature present) -- you copied the plain
  `releases\<name>.appx` instead of the signed `releases\sideload\<name>.appx`,
  or the sideload copy failed the verify step and shouldn't have been copied
  at all. Rebuild on the host and re-run `sign-and-install-msix.ps1`.
- **Still blocked after both stores are trusted and the file verifies** --
  check for a Group Policy override:
  `reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows\Appx"` on the target
  machine. An explicit `AllowAllTrustedApps=0` there overrides per-device
  trust settings.
- Get the full error rather than guessing further:
  ```
  try { Add-AppxPackage -Path $appx -ErrorAction Stop; "SUCCESS" }
  catch { $_ | Format-List * -Force }
  ```

## Undo on a target machine

```
Get-AppxPackage *AgentCommandEngine* | Remove-AppxPackage
Get-ChildItem Cert:\LocalMachine\TrustedPeople, Cert:\LocalMachine\Root |
  Where-Object Subject -eq 'CN=7F30662C-5848-43BF-AF74-FD92C644B852' | Remove-Item
```
