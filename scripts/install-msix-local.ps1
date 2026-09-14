<#
.SYNOPSIS
  Sign the ACE MSIX with the local publisher cert, trust it, install and launch.
  For LOCAL TESTING ONLY. The Store package (releases\Agent Command Engine <v>.appx)
  is uploaded UNSIGNED - the Store re-signs it. This script works on a COPY.

.USAGE
  Right-click > Run with PowerShell   (it self-elevates), or from an admin shell:
    powershell -ExecutionPolicy Bypass -File scripts\install-msix-local.ps1
    powershell -ExecutionPolicy Bypass -File scripts\install-msix-local.ps1 -Uninstall

.NOTES
  Publisher cert must already exist in Cert:\CurrentUser\My with its private key
  (subject CN=7F30662C-5848-43BF-AF74-FD92C644B852). That is what electron-builder
  used to stamp the manifest's Identity/@Publisher.
#>
[CmdletBinding()]
param(
  [string] $Package,
  [string] $CertThumbprint = "5651AC9E7BEEF0AA84D5212D4CB950EEA79D7045",
  [string] $CertSubjectCN  = "7F30662C-5848-43BF-AF74-FD92C644B852",
  [string] $PackageFamilyName = "JensR.AgentCommandEngine_xgn956jrsk21w",
  [string] $AppId = "AgentCommandEngine",
  [string] $AppxName = "JensR.AgentCommandEngine",
  [switch] $Uninstall
)

$ErrorActionPreference = "Stop"

# --- resolve script dir robustly (PSScriptRoot can be empty in some hosts) --
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = "C:\Users\jensr\Documents\VS Projects\ACE\scripts" }
if (-not $Package) {
  $Package = Join-Path $scriptDir "..\releases\ACE-0.1.33-selfsign-test.appx"
}

# --- self-elevate -----------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Elevating..." -ForegroundColor Yellow
  $self = $PSCommandPath
  if (-not $self) { $self = Join-Path $scriptDir "install-msix-local.ps1" }
  $argList = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$self`"",
    "-Package", "`"$Package`""
  )
  if ($Uninstall) { $argList += "-Uninstall" }
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  return
}

function Find-SignTool {
  $roots = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
    "${env:ProgramFiles}\Windows Kits\10\bin"
  )
  foreach ($r in $roots) {
    if (-not (Test-Path $r)) { continue }
    $hit = Get-ChildItem $r -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Where-Object FullName -match '\\x64\\' |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  throw "signtool.exe not found - install the Windows 10/11 SDK."
}

# --- uninstall / rollback -------------------------------------------------
if ($Uninstall) {
  Get-AppxPackage -Name $AppxName -ErrorAction SilentlyContinue | Remove-AppxPackage
  foreach ($store in 'Cert:\LocalMachine\Root','Cert:\LocalMachine\TrustedPeople') {
    Get-ChildItem $store -ErrorAction SilentlyContinue |
      Where-Object { $_.Subject -eq "CN=$CertSubjectCN" } |
      ForEach-Object { Write-Host "Removing $($_.Thumbprint) from $store"; Remove-Item $_.PSPath -Force }
  }
  Write-Host "Uninstalled and untrusted." -ForegroundColor Green
  Read-Host "Press Enter to close"
  return
}

# --- resolve + validate inputs -----------------------------------------
$Package = (Resolve-Path $Package).Path
if (-not (Test-Path $Package)) { throw "Package not found: $Package" }
Write-Host "Package : $Package"

$cert = Get-ChildItem "Cert:\CurrentUser\My\$CertThumbprint" -ErrorAction SilentlyContinue
if (-not $cert) {
  $cert = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object { $_.Subject -eq "CN=$CertSubjectCN" } | Select-Object -First 1
}
if (-not $cert)               { throw "Signing cert CN=$CertSubjectCN not in Cert:\CurrentUser\My" }
if (-not $cert.HasPrivateKey) { throw "Cert $($cert.Thumbprint) has no private key - cannot sign." }
Write-Host "Cert    : $($cert.Subject)  [$($cert.Thumbprint)]  expires $($cert.NotAfter)"

$signtool = Find-SignTool
Write-Host "SignTool: $signtool"

# --- 1. sign -----------------------------------------------------------
Write-Host "`n[1/4] Signing..." -ForegroundColor Cyan
& $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $Package
if ($LASTEXITCODE -ne 0) {
  Write-Host "  thumbprint match failed, retrying by subject name..." -ForegroundColor Yellow
  & $signtool sign /fd SHA256 /n $CertSubjectCN $Package
}

# --- 2. verify the signature actually landed -------------------------
Write-Host "`n[2/4] Verifying signature on the file..." -ForegroundColor Cyan
$sig = Get-AuthenticodeSignature $Package
Write-Host "  Status : $($sig.Status)"
Write-Host "  Signer : $($sig.SignerCertificate.Subject)"
if (-not $sig.SignerCertificate -or $sig.Status -eq 'NotSigned') {
  throw "Signature did not apply. signtool cannot use the key in this session."
}

# --- 3. trust the signer cert (Root + TrustedPeople, LocalMachine) --
Write-Host "`n[3/4] Trusting signer cert (LocalMachine Root + TrustedPeople)..." -ForegroundColor Cyan
$cerPath = Join-Path $env:TEMP "ace-signer.cer"
[IO.File]::WriteAllBytes($cerPath, $sig.SignerCertificate.RawData)
Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\Root          | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
Remove-Item $cerPath -Force

# --- 4. install + launch -------------------------------------------
Write-Host "`n[4/4] Installing..." -ForegroundColor Cyan
Get-Process "Agent Command Engine" -ErrorAction SilentlyContinue | Stop-Process -Force
Add-AppxPackage -Path $Package -ForceUpdateFromAnyVersion

$installed = Get-AppxPackage -Name $AppxName
Write-Host "`nInstalled: $($installed.PackageFullName)" -ForegroundColor Green
Start-Process "shell:AppsFolder\$PackageFamilyName!$AppId"
Write-Host "Launched. Roll back with:  .\install-msix-local.ps1 -Uninstall" -ForegroundColor Green
Read-Host "Press Enter to close"
