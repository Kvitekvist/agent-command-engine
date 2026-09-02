# Windows PowerShell audio player with debug logging
# Usage: powershell -File play-seatbelt-with-logging.ps1 <audio-file> <volume>

param(
    [Parameter(Mandatory=$true)]
    [string]$AudioFile,

    [Parameter(Mandatory=$false)]
    [double]$Volume = 0.7
)

$LogFile = Join-Path $PSScriptRoot "..\..\hook-execution.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    $logLine = "[$timestamp] play-seatbelt.ps1: $Message"
    try {
        Add-Content -Path $LogFile -Value $logLine -ErrorAction SilentlyContinue
    } catch {
        # Silent fail
    }
}

Write-Log "Starting playback"
Write-Log "Audio file: $AudioFile"
Write-Log "Volume: $Volume"

# Fail open - exit silently on errors
$ErrorActionPreference = 'SilentlyContinue'

# Verify file exists
if (-not (Test-Path $AudioFile)) {
    Write-Log "Audio file not found"
    exit 0
}

Write-Log "Loading MCI type definition"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class MCI {
    [DllImport("winmm.dll")]
    public static extern int mciSendString(string command, StringBuilder returnValue, int returnLength, IntPtr hwndCallback);
}
'@

# Convert volume (0.0-1.0) to MCI volume (0-1000)
$mciVolume = [int]($Volume * 1000)
Write-Log "MCI volume: $mciVolume"

Write-Log "Opening audio file"
$result = [MCI]::mciSendString("open `"$AudioFile`" alias notif", $null, 0, [IntPtr]::Zero)
Write-Log "Open result: $result"

Write-Log "Setting volume"
$result = [MCI]::mciSendString("setaudio notif volume to $mciVolume", $null, 0, [IntPtr]::Zero)
Write-Log "Volume result: $result"

Write-Log "Playing audio"
$result = [MCI]::mciSendString("play notif wait", $null, 0, [IntPtr]::Zero)
Write-Log "Play result: $result"

Write-Log "Closing audio"
$result = [MCI]::mciSendString("close notif", $null, 0, [IntPtr]::Zero)
Write-Log "Close result: $result"

Write-Log "Playback complete"
exit 0
