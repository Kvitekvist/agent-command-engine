#Requires -Version 5.1
<#
  Sign the built .appx with a local TEST certificate and install it, so the
  Store package can be smoke-tested before submission.

  The Microsoft Store re-signs the package with your real publisher cert on
  ingestion -- this script's cert is ONLY for local sideloading and never
  leaves your machine. Upload the *unsigned* releases\*.appx to Partner Center,
  not the signed copy this script makes under releases\sideload\.

  Run from an ELEVATED PowerShell:
    powershell -ExecutionPolicy Bypass -File scripts\sign-and-install-msix.ps1

  Undo everything:
    Get-AppxPackage *AgentCommandEngine* | Remove-AppxPackage
    Get-ChildItem Cert:\LocalMachine\TrustedPeople, Cert:\CurrentUser\My |
      Where-Object Subject -eq (that publisher) | Remove-Item
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# Publisher + identity name come from the manifest config, so this script
# tracks src/package.json and never needs editing when the identity changes.
$appxCfg   = (Get-Content (Join-Path $root 'src\package.json') -Raw | ConvertFrom-Json).build.appx
$publisher = $appxCfg.publisher            # must equal Identity/Publisher in the manifest
$idName    = $appxCfg.identityName         # e.g. JensR.AgentCommandEngine
if (-not $publisher -or -not $idName) { throw "build.appx.publisher / identityName missing from src/package.json" }

# Must be admin: trusting the cert machine-wide and Add-AppxPackage both need it.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this in an elevated PowerShell (Run as administrator)." }

# Newest unsigned .appx in releases\ (not releases\sideload\).
$src = Get-ChildItem (Join-Path $root 'releases') -Filter '*.appx' |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $src) { throw "No .appx in releases\ -- run: node scripts\build-msix.js" }

# signtool from the Windows 10/11 SDK.
$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw "signtool.exe not found -- install the Windows 10/11 SDK." }

# Reuse or create the test signing cert (subject MUST match the manifest publisher).
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $publisher } | Select-Object -First 1
if (-not $cert) {
  Write-Host "Creating local test certificate: $publisher"
  $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher `
    -KeyUsage DigitalSignature -FriendlyName 'ACE MSIX sideload test' `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
}

# Trust it for sideloading: LocalMachine\TrustedPeople is the store Windows checks.
$cer = Join-Path $env:TEMP 'ace-msix-test.cer'
Export-Certificate -Cert $cert -FilePath $cer -Force | Out-Null
Import-Certificate -FilePath $cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null

# Sign a COPY, leaving releases\*.appx pristine for the Store upload.
$outDir = Join-Path $root 'releases\sideload'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$signed = Join-Path $outDir $src.Name
Copy-Item $src.FullName $signed -Force

Write-Host "Signing $($src.Name)"
& $signtool.FullName sign /fd SHA256 /sha1 $cert.Thumbprint "$signed"
if ($LASTEXITCODE -ne 0) { throw "signtool failed ($LASTEXITCODE)" }

# Reinstall.
$pkgLike = ($idName -split '\.')[-1] + '*'          # e.g. AgentCommandEngine*
Get-AppxPackage $pkgLike | Remove-AppxPackage -ErrorAction SilentlyContinue
Add-AppxPackage -Path $signed

$pkg = Get-AppxPackage $pkgLike | Select-Object -First 1
Write-Host ""
Write-Host "Installed  $($pkg.PackageFullName)"
Write-Host "Launch     explorer.exe shell:AppsFolder\$($pkg.PackageFamilyName)!$($appxCfg.applicationId)"
Write-Host "Uninstall  Get-AppxPackage $pkgLike | Remove-AppxPackage"
Write-Host ""
Write-Host "Smoke test: launch it, start an agent, confirm the terminal (node-pty),"
Write-Host "the claude/codex CLI, and the notification sound all work."
