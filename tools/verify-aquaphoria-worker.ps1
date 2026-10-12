param(
  [string]$TaskName = 'Aquaphoria Discord Worker',
  [string]$HealthUrl = 'http://127.0.0.1:8790/health',
  [string]$ReadyUrl = 'http://127.0.0.1:8790/ready'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$info = Get-ScheduledTaskInfo -TaskName $TaskName
$health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5

$ready = $null
$readinessError = $null
try {
  $ready = Invoke-RestMethod -Uri $ReadyUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
} catch {
  $readinessError = $_.Exception.Message
}
# Gateway login alone does NOT mean private-channel provisioning or command registration succeeded.
$workerReady = $null -ne $ready -and $ready.ok -eq $true -and
  $ready.initialized -eq $true -and $ready.startupFailed -eq $false

$result = [ordered]@{
  taskName = $TaskName
  taskState = [string]$task.State
  lastTaskResult = $info.LastTaskResult
  lastRunTime = $info.LastRunTime
  nextRunTime = $info.NextRunTime
  healthUrl = $HealthUrl
  readyUrl = $ReadyUrl
  gatewayConnected = [bool]$health.ok
  workerReady = [bool]$workerReady
  bootstrapInitialized = [bool]$ready.initialized
  bootstrapFailed = [bool]$ready.startupFailed
  readinessError = $readinessError
  service = $health.service
  gptConfigured = [bool]$health.gptConfigured
}

$result | ConvertTo-Json -Depth 4

if ($task.State -notin @('Running','Ready')) { exit 2 }
if (-not $workerReady) { exit 3 }
if ($health.gptConfigured -ne $true) { exit 4 }
exit 0
