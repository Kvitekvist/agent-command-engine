# Windows PowerShell audio player using Windows Media Control Interface (MCI)
# Usage: powershell -File play-seatbelt.ps1 <audio-file> <volume>

param(
    [Parameter(Mandatory=$true)]
    [string]$AudioFile,

    [Parameter(Mandatory=$false)]
    [double]$Volume = 0.7
)

# Fail open - exit silently on errors
$ErrorActionPreference = 'SilentlyContinue'

# Verify file exists
if (-not (Test-Path $AudioFile)) {
    exit 0
}

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

# Open and play
$null = [MCI]::mciSendString("open `"$AudioFile`" alias notif", $null, 0, [IntPtr]::Zero)
$null = [MCI]::mciSendString("setaudio notif volume to $mciVolume", $null, 0, [IntPtr]::Zero)
$null = [MCI]::mciSendString("play notif wait", $null, 0, [IntPtr]::Zero)
$null = [MCI]::mciSendString("close notif", $null, 0, [IntPtr]::Zero)

exit 0
