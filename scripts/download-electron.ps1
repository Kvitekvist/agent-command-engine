# Electron Binary Downloader (PowerShell)
# Bypasses proxy and tries multiple download sources

$Version = "31.7.7"
$FileName = "electron-v$Version-win32-x64.zip"
$SrcDir = Join-Path $PSScriptRoot "..\src"
$ElectronDir = Join-Path $SrcDir "node_modules\electron"
$DistDir = Join-Path $ElectronDir "dist"
$PathTxt = Join-Path $ElectronDir "path.txt"
$ZipPath = Join-Path $ElectronDir $FileName

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Electron Binary Downloader" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $PathTxt) {
    Write-Host "Electron already installed!" -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $ElectronDir)) {
    Write-Host "ERROR: node_modules\electron not found. Run setup.bat first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if zip was manually placed
if (Test-Path $ZipPath) {
    Write-Host "Found manually placed zip file. Extracting..." -ForegroundColor Green
    goto :extract
}

$Mirrors = @(
    "https://github.com/electron/electron/releases/download/v$Version/$FileName",
    "https://npmmirror.com/mirrors/electron/v$Version/$FileName",
    "https://cdn.npmmirror.com/binaries/electron/v$Version/$FileName"
)

$Downloaded = $false

foreach ($Mirror in $Mirrors) {
    Write-Host "Trying: $Mirror" -ForegroundColor Yellow
    try {
        # Try with no proxy first
        $WebClient = New-Object System.Net.WebClient
        $WebClient.Proxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
        $WebClient.DownloadFile($Mirror, $ZipPath)
        Write-Host "Downloaded successfully!" -ForegroundColor Green
        $Downloaded = $true
        break
    } catch {
        Write-Host "  Failed (no proxy): $_" -ForegroundColor Gray
        # Try with system proxy
        try {
            Invoke-WebRequest -Uri $Mirror -OutFile $ZipPath -UseDefaultCredentials
            Write-Host "Downloaded successfully (via system proxy)!" -ForegroundColor Green
            $Downloaded = $true
            break
        } catch {
            Write-Host "  Failed (system proxy): $_" -ForegroundColor Gray
        }
        if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    }
}

if (-not $Downloaded -and -not (Test-Path $ZipPath)) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " ALL DOWNLOADS FAILED - MANUAL STEP REQUIRED" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your network is blocking the download from GitHub." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1 - Use a mobile hotspot temporarily:" -ForegroundColor Cyan
    Write-Host "  1. Connect your PC to a mobile hotspot"
    Write-Host "  2. Run this script again"
    Write-Host ""
    Write-Host "Option 2 - Download manually:" -ForegroundColor Cyan
    Write-Host "  1. On any device, go to:"
    Write-Host "     https://github.com/electron/electron/releases/tag/v$Version"
    Write-Host "  2. Download: $FileName"
    Write-Host "  3. Place it here:"
    Write-Host "     $ZipPath"
    Write-Host "  4. Run this script again"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

:extract
Write-Host ""
Write-Host "Extracting to $DistDir ..." -ForegroundColor Yellow
if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir -Force | Out-Null }
Expand-Archive -Path $ZipPath -DestinationPath $DistDir -Force
Write-Host "Extraction complete." -ForegroundColor Green

# Write path.txt
Set-Content -Path $PathTxt -Value "electron.exe" -NoNewline
Write-Host "Created path.txt" -ForegroundColor Green

# Cleanup
Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " SUCCESS! Electron is ready." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Starting the app..." -ForegroundColor Cyan
Set-Location $SrcDir
npm run dev
