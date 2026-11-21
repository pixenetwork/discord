param(
  [string]$WorkerDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$TaskName = 'Aquaphoria Discord Worker'
)

$ErrorActionPreference = 'Stop'

# Least-privileged, per-user persistence; does not elevate to SYSTEM or
# immediately start a second Discord client beside an active supervisor.
$supervisor = Join-Path $WorkerDir 'tools\aquaphoria-worker-supervisor.ps1'
$entry = Join-Path $WorkerDir 'src\index.mjs'
$envFile = Join-Path $WorkerDir '.env'
foreach ($file in @($supervisor, $entry, $envFile)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Aquaphoria runtime prerequisite missing from the selected checkout"
  }
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Output "Existing $TaskName task preserved ($($existing.State)); not modifying its owner, trigger, or runtime."
  exit 0
}

$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
if (-not $currentUser -or $currentUser -eq 'NT AUTHORITY\SYSTEM') {
  throw 'A logged-in, non-SYSTEM user is required for a per-user task'
}

$node = Get-Command node -ErrorAction Stop
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -WorkerDir "{1}" -NodeExe "{2}"' -f $supervisor, $WorkerDir, $node.Source

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $WorkerDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Aquaphoria Discord bot: per-user, single-supervisor session on login; local .env stays on this PC.' -ErrorAction Stop | Out-Null
$readback = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if ($readback.Principal.UserId -ne $currentUser -or $readback.Principal.RunLevel -ne 'Limited') {
  throw 'Task registration readback did not confirm limited current-user ownership'
}
Write-Output "Aquaphoria task installed for $currentUser at login: $($readback.State). Existing live process was not touched."
