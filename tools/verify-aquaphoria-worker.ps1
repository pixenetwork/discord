param(
  [string]$TaskName = 'Aquaphoria Discord Worker',
  [string]$HealthUrl = 'http://127.0.0.1:8790/health'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$info = Get-ScheduledTaskInfo -TaskName $TaskName
$health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5

$result = [ordered]@{
  taskName = $TaskName
  taskState = [string]$task.State
  lastTaskResult = $info.LastTaskResult
  lastRunTime = $info.LastRunTime
  nextRunTime = $info.NextRunTime
  healthUrl = $HealthUrl
  workerReady = [bool]$health.ok
  service = $health.service
  gptConfigured = [bool]$health.gptConfigured
}

$result | ConvertTo-Json -Depth 4

if ($task.State -notin @('Running','Ready')) { exit 2 }
if ($health.ok -ne $true) { exit 3 }
if ($health.gptConfigured -ne $true) { exit 4 }
exit 0
