# Windows audio player via cscript/VBScript — works in detached/headless sessions.
# WMPlayer COM (WMPlayer.OCX.7) needs cscript's message pump; it hangs in state 9 under
# pure PowerShell spawned detached from node.
# Usage: powershell -File play-seatbelt.ps1 <audio-file> <volume>

param(
    [Parameter(Mandatory=$true)]
    [string]$AudioFile,

    [Parameter(Mandatory=$false)]
    [double]$Volume = 0.7
)

$ErrorActionPreference = 'SilentlyContinue'

if (-not (Test-Path $AudioFile)) { exit 0 }

$vbs = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.vbs'
$vol = [int]($Volume * 100)
$escaped = $AudioFile -replace '"', '""'

@"
Dim wmp
Set wmp = CreateObject("WMPlayer.OCX.7")
wmp.settings.volume = $vol
wmp.URL = "$escaped"
wmp.controls.play()
Dim deadline
deadline = Timer + 30
Do While wmp.playState <> 1
    WScript.Sleep 200
    If Timer > deadline Then Exit Do
Loop
wmp.controls.stop()
Set wmp = Nothing
"@ | Set-Content -Path $vbs -Encoding ASCII

try {
    $p = Start-Process -FilePath 'cscript.exe' -ArgumentList '//nologo', "`"$vbs`"" -Wait -PassThru -WindowStyle Hidden
} finally {
    Remove-Item $vbs -ErrorAction SilentlyContinue
}

exit 0
