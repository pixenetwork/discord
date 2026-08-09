param(
  [string]$WorkerDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$TaskName = 'Aquaphoria Discord Worker',
  [string]$HealthUrl = 'http://127.0.0.1:8787/health'
)

$ErrorActionPreference = 'Stop'

$supervisor = Join-Path $WorkerDir 'tools\aquaphoria-worker-supervisor.ps1'
if (-not (Test-Path -LiteralPath $supervisor)) {
  throw "Supervisor script not found: $supervisor"
}

$node = Get-Command node -ErrorAction Stop
$envFile = Join-Path $WorkerDir '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Runtime secret file is missing: $envFile. Create it locally from .env.example; do not commit it."
}

$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$supervisor`" -WorkerDir `"$WorkerDir`" -NodeExe `"$($node.Source)`" -HealthUrl `"$HealthUrl`""

$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $WorkerDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Persistent self-healing Aquaphoria Discord/Shopify worker. Restarts on process exit or failed health checks.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 5

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "Installed: $TaskName"
Write-Host "State: $($task.State)"
Write-Host "LastTaskResult: $($info.LastTaskResult)"
Write-Host "WorkerDir: $WorkerDir"
Write-Host "Health: $HealthUrl"
