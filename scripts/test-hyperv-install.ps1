#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
Test a signed ACE AppX on a disposable Hyper-V Windows VM using PowerShell Direct.
.DESCRIPTION
Guest credentials are prompted securely. The test user must already be signed
in and be a local administrator. Every run restores the named clean checkpoint,
discarding the VM's current state before installing anything.
Reports are retained on the host; the guest is left in its tested state.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$VMName,
    [Parameter(Mandatory)][string]$Package,
    [Parameter(Mandatory)][string]$Certificate,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Checkpoint,
    [PSCredential]$Credential,
    [ValidateRange(60, 3600)][int]$TimeoutSeconds = 600,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\releases\install-tests')
)
$ErrorActionPreference = 'Stop'
$Package = (Resolve-Path -LiteralPath $Package).Path
$Certificate = (Resolve-Path -LiteralPath $Certificate).Path
if ([IO.Path]::GetExtension($Package) -notin @('.appx', '.msix')) { throw 'Supply a sealed .appx or .msix package' }
Import-Module Hyper-V
$vm = Get-VM -Name $VMName
if (@($vm).Count -ne 1 -or $vm.Name -ne $VMName) { throw 'Select one VM by its exact name, not a wildcard' }
$snapshot = @(Get-VMSnapshot -VM $vm | Where-Object Name -eq $Checkpoint)
if ($snapshot.Count -ne 1) { throw 'Checkpoint name must identify exactly one snapshot on this VM' }
if (-not $Credential) { $Credential = Get-Credential -Message "Local administrator already signed in to $VMName" }
if (-not $Credential) { throw 'Guest credentials are required' }
$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$output = New-Item -ItemType Directory -Path (Join-Path $OutputDirectory $runId)
$summary = [ordered]@{ passed = $false; vm = $vm.Name; checkpoint = $Checkpoint; checkpointId = $snapshot[0].Id.ToString(); restored = $false; package = $Package; sha256 = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash }
$session = $null
$guestDirectory = $null
$taskName = "ACE-InstallTest-$runId"
try {
    Write-Host "Restoring disposable VM '$VMName' to '$Checkpoint'"
    if ($vm.State -in @('Running', 'Paused')) { Stop-VM -VM $vm -TurnOff -Force }
    Restore-VMSnapshot -VMSnapshot $snapshot[0] -Confirm:$false
    $summary.restored = $true
    if ((Get-VM -Id $vm.Id).State -ne 'Running') { Start-VM -VM $vm | Out-Null }
    Wait-VM -VM $vm -For Heartbeat -Timeout 120
    # Authenticate once: retrying bad credentials can lock out the test account.
    $session = New-PSSession -VMId $vm.Id -Credential $Credential -ErrorAction Stop
    $guestDirectory = Invoke-Command -Session $session -ArgumentList $runId -ScriptBlock {
        param($id)
        $ErrorActionPreference = 'Stop'
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Guest credentials must be a local administrator' }
        $desktop = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" | Where-Object {
            (Invoke-CimMethod -InputObject $_ -MethodName GetOwnerSid).Sid -eq $identity.User.Value
        }
        if (-not $desktop) { throw 'Sign in to the guest desktop with the supplied test account, then retry' }
        (New-Item -ItemType Directory -Path (Join-Path $env:ProgramData "ACE-InstallTests\$id") -Force).FullName
    }
    Copy-Item -LiteralPath $Package -Destination "$guestDirectory\ACE.appx" -ToSession $session
    Copy-Item -LiteralPath $Certificate -Destination "$guestDirectory\signer.cer" -ToSession $session
    foreach ($file in @('test-installed-appx.ps1', 'smoke-installed-setup.cjs')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination "$guestDirectory\$file" -ToSession $session
    }
    Invoke-Command -Session $session -ArgumentList $guestDirectory, $taskName, $TimeoutSeconds -ScriptBlock {
        param($directory, $name, $timeout)
        $ErrorActionPreference = 'Stop'
        $arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$directory\test-installed-appx.ps1`" -RunDirectory `"$directory`" -TimeoutSeconds $timeout"
        $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $arguments
        $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds ($timeout + 240))
        Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Settings $settings | Out-Null
        Start-ScheduledTask -TaskName $name
    }
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds + 240)
    do {
        $result = Invoke-Command -Session $session -ArgumentList $guestDirectory -ScriptBlock {
            param($directory)
            $file = Join-Path $directory 'result.json'
            if (Test-Path -LiteralPath $file) { Get-Content -LiteralPath $file -Raw }
        }
        if ($result) { break }
        if ((Get-Date) -ge $deadline) { throw 'Guest test timed out; inspect the retained VM and logs' }
        Start-Sleep -Seconds 2
    } while ($true)
    $guestResult = $result | ConvertFrom-Json
    if (-not $guestResult.passed) { throw "Guest failed at $($guestResult.stage): $($guestResult.error)" }
    $summary.passed = $true
} catch { $summary.error = $_.Exception.Message }
finally {
    if ($session) {
        try {
            Invoke-Command -Session $session -ArgumentList $taskName -ScriptBlock {
                param($name)
                if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
                    Stop-ScheduledTask -TaskName $name
                    Unregister-ScheduledTask -TaskName $name -Confirm:$false
                }
            }
            if ($guestDirectory) {
                # Copy evidence only, not the 250 MB package or guest credentials.
                $files = Invoke-Command -Session $session -ArgumentList $guestDirectory -ScriptBlock {
                    param($directory)
                    Get-ChildItem -LiteralPath $directory -File | Where-Object Extension -in @('.json', '.log', '.png') | Select-Object -ExpandProperty FullName
                }
                foreach ($file in $files) { Copy-Item -LiteralPath $file -Destination $output.FullName -FromSession $session }
            }
        } catch { $summary.evidenceError = $_.Exception.Message; $summary.passed = $false }
        Remove-PSSession $session
    }
    $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output.FullName 'host.json') -Encoding UTF8
    Write-Host "Install-test report: $($output.FullName)"
}
if (-not $summary.passed) { throw "Install test failed: $($summary.error) $($summary.evidenceError)" }
Write-Host 'PASS: sealed AppX installed and first-run prerequisites became ready without a restart.'
