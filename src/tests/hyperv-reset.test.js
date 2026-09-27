const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('every Hyper-V run restores its baseline before guest access; restore failure stops the run', { skip: process.platform !== 'win32' }, () => {
  const runner = path.resolve(__dirname, '../../scripts/test-hyperv-install.ps1').replace(/'/g, "''")
  // Execute the runner's actual startup statements with fake Hyper-V commands.
  // Never import Hyper-V or execute the rest of the runner on the test host.
  const script = `
$ErrorActionPreference = 'Stop'
$tokens = $null; $issues = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${runner}', [ref]$tokens, [ref]$issues)
if ($issues.Count) { throw 'Runner syntax error' }
$checkpoint = $ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'Checkpoint' }
if (-not ($checkpoint.Attributes.NamedArguments | Where-Object ArgumentName -eq 'Mandatory')) { throw 'Checkpoint must be mandatory' }
$body = ($ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.TryStatementAst] }).Body
$startup = @()
foreach ($statement in $body.Statements) {
  if ($statement -is [System.Management.Automation.Language.AssignmentStatementAst] -and $statement.Left.Extent.Text -eq '$guestDirectory') { break }
  $startup += $statement.Extent.Text
}
$run = [scriptblock]::Create($startup -join [Environment]::NewLine)
$calls = [Collections.Generic.List[string]]::new()
$snapshot = @([pscustomobject]@{ Id = 'baseline' })
$summary = @{ restored = $false }
function Write-Host { param($Object) }
function Stop-VM { param($VM, [switch]$TurnOff, [switch]$Force) $calls.Add('stop'); $VM.State = 'Off' }
function Restore-VMSnapshot {
  param($VMSnapshot, [switch]$Confirm)
  if ($VMSnapshot.Id -ne 'baseline') { throw 'Wrong checkpoint' }
  $calls.Add('restore')
  if ($failRestore) { throw 'restore failed' }
}
function Get-VM { param($Id) $vm }
function Start-VM { param($VM) $calls.Add('start') }
function Wait-VM { param($VM, $For, $Timeout) $calls.Add('wait') }
function New-PSSession { param($VMId, $Credential, $ErrorAction) $calls.Add('connect'); 'fake-session' }
foreach ($state in @('Running', 'Paused')) {
  $vm = [pscustomobject]@{ Id = 'test'; State = $state }
  $summary.restored = $false
  $calls.Clear()
  . $run
  if (($calls -join ',') -ne 'stop,restore,start,wait,connect' -or -not $summary.restored) { throw 'Run did not restore before connecting' }
}
$calls.Clear(); $summary.restored = $false; $failRestore = $true
try { . $run; throw 'Expected restore failure' }
catch { if ($_.Exception.Message -ne 'restore failed') { throw } }
if (($calls -join ',') -ne 'restore' -or $summary.restored) { throw 'Failed restore continued into the guest' }
Write-Output 'Checkpoint restore checks passed'
`
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.match(result.stdout, /Checkpoint restore checks passed/)
})
