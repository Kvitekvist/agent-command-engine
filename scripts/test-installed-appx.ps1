# Guest half of test-hyperv-install.ps1. Run only inside a disposable VM.
#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$RunDirectory,
    [ValidateRange(60, 3600)][int]$TimeoutSeconds = 600
)
$ErrorActionPreference = 'Stop'
$result = [ordered]@{ passed = $false; started = (Get-Date).ToString('o'); stage = 'preflight' }
$aceProcess = $null
$probe = $null
Start-Transcript -Path (Join-Path $RunDirectory 'guest.log') | Out-Null
try {
    # Check the real saved environment, not a possibly stale remoting PATH.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $found = @('node', 'npm', 'git', 'claude', 'codex') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }
    if ($found) { throw "Checkpoint is not clean; prerequisites already present: $($found -join ', ')" }
    if (Get-AppxPackage -Name 'JensR.AgentCommandEngine') { throw 'Checkpoint already has ACE installed' }
    foreach ($profilePath in @(
        (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ACE\ace.db'),
        (Join-Path $env:USERPROFILE '.ace\ace.db')
    )) {
        if (Test-Path -LiteralPath $profilePath) { throw "Checkpoint contains ACE settings: $profilePath" }
    }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Windows App Installer (winget) is missing. Prepare it in the baseline; do not preinstall Node or CLIs.'
    }
    $result.stage = 'install'
    foreach ($store in @('Cert:\LocalMachine\TrustedPeople', 'Cert:\LocalMachine\Root')) {
        Import-Certificate -FilePath (Join-Path $RunDirectory 'signer.cer') -CertStoreLocation $store | Out-Null
    }
    Add-AppxPackage -Path (Join-Path $RunDirectory 'ACE.appx')
    $package = Get-AppxPackage -Name 'JensR.AgentCommandEngine'
    if (-not $package) { throw 'Add-AppxPackage completed but ACE is not registered for the test user' }
    $result.package = $package.PackageFullName
    $manifest = Get-AppxPackageManifest -Package $package.PackageFullName
    $application = @($manifest.Package.Applications.Application) | Where-Object Id -eq 'AgentCommandEngine'
    if (-not $application) { throw 'ACE application entry is missing from the installed manifest' }
    $executable = Join-Path $package.InstallLocation $application.Executable
    $result.stage = 'setup'
    # Reserve an unused local debugging port, then release it for Chromium.
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    $aceProcess = Start-Process -FilePath $executable -ArgumentList "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port" -WindowStyle Hidden -PassThru
    $configFile = Join-Path $RunDirectory 'probe-config.json'
    @{ pid = $aceProcess.Id; port = $port; timeoutMs = $TimeoutSeconds * 1000 } |
        ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding UTF8
    $previousRunAsNode = $env:ELECTRON_RUN_AS_NODE
    try {
        $env:ELECTRON_RUN_AS_NODE = '1'
        $probeScript = Join-Path $RunDirectory 'smoke-installed-setup.cjs'
        $probe = Start-Process -FilePath $executable -ArgumentList "`"$probeScript`" `"$configFile`"" -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $RunDirectory 'probe.log') -RedirectStandardError (Join-Path $RunDirectory 'probe-errors.log')
    } finally { $env:ELECTRON_RUN_AS_NODE = $previousRunAsNode }
    if (-not $probe.WaitForExit(($TimeoutSeconds + 120) * 1000)) { throw 'Setup probe exceeded its deadline' }
    $probe.WaitForExit()
    if ($probe.ExitCode -ne 0) { throw "Setup probe failed ($($probe.ExitCode)); see setup.json and probe-errors.log" }
    $setup = Get-Content -LiteralPath (Join-Path $RunDirectory 'setup.json') -Raw | ConvertFrom-Json
    if (-not $setup.passed) { throw 'Setup probe did not report success' }
    $result.passed = $true
    $result.stage = 'complete'
} catch {
    $result.error = $_.Exception.Message
    Get-WinEvent -LogName 'Microsoft-Windows-AppXDeploymentServer/Operational' -MaxEvents 30 -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, Id, Message | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $RunDirectory 'deployment-events.json') -Encoding UTF8
} finally {
    foreach ($child in @($probe, $aceProcess)) {
        if ($child -and -not $child.HasExited) {
            # Only the process trees started by this run; no blanket process-name kill.
            & "$env:SystemRoot\System32\taskkill.exe" /PID $child.Id /T /F | Out-Null
        }
    }
    $result.finished = (Get-Date).ToString('o')
    $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $RunDirectory 'result.json') -Encoding UTF8
    Stop-Transcript | Out-Null
}
if (-not $result.passed) { exit 1 }
