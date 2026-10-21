[CmdletBinding()]
param(
  [string]$WorkerDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$TaskName = 'Aquaphoria Discord Worker',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$workerDir = [IO.Path]::GetFullPath($WorkerDir)
$envFile = Join-Path $workerDir '.env'
$entry = Join-Path $workerDir 'src\index.mjs'
$verify = Join-Path $workerDir 'tools\verify-research-queue-command.mjs'
$supervisor = Join-Path $workerDir 'tools\aquaphoria-worker-supervisor.ps1'
$stateRoot = Join-Path $workerDir 'data'
$port = 8790
$readyUrl = 'http://127.0.0.1:8790/ready'

# Never select an alternate task or an arbitrary port by accident.
if ($TaskName -cne 'Aquaphoria Discord Worker') {
  throw 'Unexpected task name: this operator procedure is only for Aquaphoria'
}
foreach ($file in @($envFile, $entry, $verify, $supervisor)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw 'Expected Aquaphoria worker prerequisite is missing'
  }
}
if (-not (Select-String -LiteralPath (Join-Path $workerDir 'src\commands.mjs') -Pattern "setName\('research-queue'\)" -Quiet)) {
  throw 'The chosen checkout does not include the research-queue command'
}

$dataLine = @(Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATA_DIR=' }) | Select-Object -Last 1
if ($dataLine) {
  $value = ($dataLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
  if ($value) {
    $stateRoot = if ([IO.Path]::IsPathRooted($value)) { $value } else { Join-Path $workerDir $value }
  }
}
$statePath = Join-Path ([IO.Path]::GetFullPath($stateRoot)) 'aquaphoria-discord.json'
if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
  throw 'Cannot restart without finding the existing durable worker state'
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $Apply) {
  Write-Output ('PREVIEW_ONLY=true TaskName=' + $TaskName)
  Write-Output ('workerSource=' + $workerDir + ' existingStateBytes=' + (Get-Item -LiteralPath $statePath).Length)
  Write-Output ('elevated=' + $isAdmin + ' no_task_or_bot_changed=true')
  exit 0
}
if (-not $isAdmin) { throw 'ADMIN_REQUIRED: run this operator script from an elevated PowerShell' }

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$arguments = ($task.Actions | ForEach-Object { [string]$_.Arguments }) -join ' '
if (($arguments -notmatch 'aquaphoria-worker-supervisor\.ps1') -or ($arguments.IndexOf($workerDir, [StringComparison]::OrdinalIgnoreCase) -lt 0)) {
  throw 'Protected task does not point to the selected Aquaphoria supervisor and checkout'
}

$existingListeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
if ($existingListeners.Count -ne 1) { throw 'Expected exactly one live Aquaphoria listener on port 8790' }
$originalPid = [int]$existingListeners[0].OwningProcess
$child = Get-CimInstance Win32_Process -Filter "ProcessId=$originalPid"
if (-not $child -or $child.Name -cne 'node.exe') {
  throw 'Expected the existing listener to belong to the supervised Node worker'
}
$parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($child.ParentProcessId)"
if (-not $parent -or $parent.Name -cne 'powershell.exe') {
  throw 'Unexpected worker ancestry: refusing to restart any other process'
}
try {
  $ready = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 5
  if (-not $ready.ok -or $ready.service -cne 'aquaphoria-discord') {
    throw 'Live worker readiness validation failed'
  }
} catch { throw 'Live worker not ready before the controlled restart' }

$backupRoot = Join-Path ([IO.Path]::GetDirectoryName($statePath)) 'backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backup = Join-Path $backupRoot ('aquaphoria-research-queue-pre-admin-restart-' + $stamp + '.json')
Copy-Item -LiteralPath $statePath -Destination $backup -ErrorAction Stop
if ((Get-FileHash -LiteralPath $statePath -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash) {
  throw 'State backup validation failed: no task was changed'
}
Write-Output ('BACKUP_VERIFIED=' + $backup)
Write-Output ('STOPPING_VERIFIED_TASK=' + $TaskName + ' workerPid=' + $originalPid)
Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop

# Do not launch a second Discord client unless the original listener is gone.
$stopped = $false
for ($i = 0; $i -lt 30; $i++) {
  $listener = @(Get-NetTCPConnection -State Listen -LocalPort 8790 -ErrorAction SilentlyContinue)
  if ($listener.Count -eq 0) { $stopped = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $stopped) {
  # Some Windows task stops leave the child Node process running. Recover
  # only the *same* already-verified PID when its supervisor is demonstrably gone.
  $remaining = @(Get-NetTCPConnection -State Listen -LocalPort 8790 -ErrorAction SilentlyContinue)
  $taskStillStopped = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  if (($taskStillStopped.State -ne 'Ready') -or ($remaining.Count -ne 1) -or ([int]$remaining[0].OwningProcess -ne $originalPid)) {
    throw 'Listener or task state changed; refusing to stop an unrelated process'
  }
  $oldChild = Get-CimInstance Win32_Process -Filter "ProcessId=$originalPid" -ErrorAction Stop
  if ((-not $oldChild) -or ($oldChild.Name -cne 'node.exe') -or ([int]$oldChild.ParentProcessId -ne [int]$child.ParentProcessId) -or (-not $oldChild.CommandLine) -or ($oldChild.CommandLine.IndexOf('src\index.mjs', [StringComparison]::OrdinalIgnoreCase) -lt 0)) {
    throw 'Original orphan identity cannot be verified safely'
  }
  $oldParent = Get-CimInstance Win32_Process -Filter "ProcessId=$($child.ParentProcessId)" -ErrorAction SilentlyContinue
  if ($oldParent) { throw 'Supervisor process still exists; refusing to kill its child' }
  Stop-Process -Id $originalPid -Force -ErrorAction Stop
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (@(Get-NetTCPConnection -State Listen -LocalPort 8790 -ErrorAction SilentlyContinue).Count -eq 0) {
      $stopped = $true
      break
    }
  }
  if (-not $stopped) { throw 'Verified orphan did not release port; no replacement started' }
}
Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$booted = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  try {
    $status = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 2
    if ($status.ok -and $status.initialized -and -not $status.startupFailed) {
      $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8790 -ErrorAction SilentlyContinue)
      if ($listeners.Count -eq 1 -and [int]$listeners[0].OwningProcess -ne $originalPid) {
        $booted = $true
        break
      }
    }
  } catch { }
}
if (-not $booted) { throw 'Aquaphoria did not confirm a single ready replacement worker' }

$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
& $nodeExe "--env-file=$envFile" $verify
if ($LASTEXITCODE -ne 0) {
  throw 'Worker became healthy but /research-queue is not yet registered with Discord'
}
Write-Output 'verified-queue=true new_worker_ready=true preserved_state=true duplicate_bot=false'
