<#
.SYNOPSIS
  Make a clean Windows PC ready for ACE: install Node.js LTS (via winget) if
  missing, then the Claude Code and Codex CLIs (via npm global).

  ACE's in-app Settings > Prerequisites buttons install the two CLIs but are
  greyed out until Node + npm exist, because they just shell out to
  `npm install -g`. This script fills that gap.

.USAGE
  Right-click > Run with PowerShell   (it self-elevates), or from a shell:
    powershell -ExecutionPolicy Bypass -File scripts\bootstrap-prereqs.ps1

.NOTES
  Idempotent: skips anything already present. Safe to re-run.
  Node install needs admin (machine scope); the script self-elevates.
  Requires winget (App Installer) - preinstalled on Windows 11.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# --- self-elevate (winget machine-scope install needs admin) --------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Elevating..." -ForegroundColor Yellow
  $self = $PSCommandPath
  if (-not $self) { $self = $MyInvocation.MyCommand.Path }
  Start-Process powershell -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$self`""
  )
  return
}

function Test-Cmd($name) {
  return [bool] (Get-Command $name -ErrorAction SilentlyContinue)
}

function Update-SessionPath {
  # winget updates the registry PATH, not this already-running process.
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user    = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = ($machine, $user | Where-Object { $_ }) -join ";"
}

# --- 1. Node.js + npm ----------------------------------------------------
if ((Test-Cmd node) -and (Test-Cmd npm)) {
  Write-Host "[1/2] Node $(node --version), npm $(npm --version) - already present." -ForegroundColor Green
} else {
  if (-not (Test-Cmd winget)) {
    throw "winget not found. Install 'App Installer' from the Microsoft Store, or Node from https://nodejs.org, then re-run."
  }
  Write-Host "[1/2] Installing Node.js LTS via winget..." -ForegroundColor Cyan
  winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "winget install of Node failed (exit $LASTEXITCODE)." }
  Update-SessionPath
  if (-not (Test-Cmd npm)) {
    throw "Node installed but npm still not on PATH. Close this window, open a NEW terminal, and re-run."
  }
  Write-Host "  Node $(node --version), npm $(npm --version)" -ForegroundColor Green
}

# --- 2. Claude Code + Codex CLIs --------------------------------------
$pkgs = @{
  "claude" = "@anthropic-ai/claude-code"
  "codex"  = "@openai/codex"
}
Write-Host "`n[2/2] Installing CLIs..." -ForegroundColor Cyan
foreach ($cmd in $pkgs.Keys) {
  if (Test-Cmd $cmd) {
    Write-Host "  $cmd - already present ($(& $cmd --version 2>$null))" -ForegroundColor Green
    continue
  }
  Write-Host "  npm install -g $($pkgs[$cmd])"
  npm install -g $pkgs[$cmd]
  if ($LASTEXITCODE -ne 0) { throw "npm install of $($pkgs[$cmd]) failed (exit $LASTEXITCODE)." }
}

# --- verify ---------------------------------------------------------------
Update-SessionPath
Write-Host "`nDone. Versions:" -ForegroundColor Green
foreach ($c in @("node", "npm", "git", "claude", "codex")) {
  $v = if (Test-Cmd $c) { (& $c --version 2>$null) -join " " } else { "NOT FOUND" }
  "{0,-8} {1}" -f $c, $v
}
Write-Host "`nRestart ACE so it picks up the new PATH." -ForegroundColor Yellow
Read-Host "Press Enter to close"
