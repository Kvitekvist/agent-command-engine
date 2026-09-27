# Hyper-V install test

Run this from an elevated Windows PowerShell on the Hyper-V host. No Node,
npm, Git, SDK or test library is needed in the guest. The probe uses the Node
runtime already inside the installed ACE executable.

## Prepare one disposable VM

Use Windows 10/11 with internet access and Windows App Installer (`winget`).
Create a local administrator test account with a password and sign in to its
desktop. Leave Node, npm, Git, Claude, Codex and ACE uninstalled. Do not use a
VM containing real projects, provider accounts or other valuable data.

Create a **standard checkpoint while that account is signed in**, for example
`ACE-clean`. A standard checkpoint preserves the interactive session. A
production checkpoint requires signing in again after restore. The runner
does not configure autologon or save passwords.

List available targets from the elevated host shell:

```powershell
Get-VM
Get-VMSnapshot -VMName 'ACE-Test'
```

## Run

Use an already signed AppX and its public signing certificate. The runner
trusts the certificate only inside the selected guest, not on the host.
Every invocation discards that VM's current state and restores the required
`-Checkpoint` before copying or installing anything. Use the same clean baseline
for every run, not the most recent snapshot of a previously tested machine.
There is no skip-reset mode. A missing, ambiguous or failed checkpoint restore
stops the test before guest access.

```powershell
.\scripts\test-hyperv-install.ps1 `
  -VMName 'ACE-Test' -Checkpoint 'ACE-clean' `
  -Package '.\releases\prereq-fix\ACE-prereq-fix.appx' `
  -Certificate '.\releases\prereq-fix\ace-test-cert.cer'
```

Enter the signed-in guest account at the credential prompt, for example
`ACE-TEST\tester`. Credentials stay in memory. The guest preflight also
rejects an existing ACE install/settings or prerequisites already on PATH.

The VM must have connectivity for the real winget/npm downloads. PowerShell
Direct itself needs neither a guest network connection nor WinRM setup. See
[Microsoft's PowerShell Direct requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/powershell-direct).

## What passes

1. The sealed package installs with `Add-AppxPackage`; no loose `-Register` shortcut.
2. The installed renderer shows the first-run setup screen and performs its
   normal automatic installation. The probe never calls the install handlers.
3. ACE reports Node, npm, bundled Git, Claude and Codex present through its
   real preload/IPC check. They remain ready for 15 seconds.
4. The original ACE process stays alive. A restart, renderer disconnect,
   visible setup error or timeout fails the run, including the Node install loop.

The default setup timeout is ten minutes (`-TimeoutSeconds 1200` allows twenty).
The host allows additional time for package installation and probe startup.
The test leaves the VM in its tested state for inspection. The next test
automatically restores the same clean checkpoint first, even after a failed
run. The baseline checkpoint is never replaced. It removes its own scheduled task and stops
the process trees it launched; it does not uninstall shared software or delete
guest profiles.

Reports go under `releases/install-tests/<run>/`: package SHA-256 and host
result (including checkpoint ID and restore completion), guest transcript, AppX deployment events on failure, prerequisite
samples, probe logs, and `setup.png` when the renderer remains available.
A failed run exits nonzero. The package and credentials are not copied into
the report directory.

## Scope

The guest task runs elevated under the signed-in test account so winget can
complete unattended. This tests installation and the restart regression; it
does **not** verify a normal user's UAC consent/cancellation flow, Store
delivery, provider login or a live agent session. Existing PTY smoke tests
cover terminal startup separately. Chromium debugging is enabled on loopback
only for this test process and is closed when that process is stopped.

Current validation: runner/probe checks can run on the developer host, but
the end-to-end Hyper-V run requires an elevated host session, a named VM and
guest credentials. Do not treat a successful unit test as a VM install pass.
