param(
  [string]$WorkerDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$NodeExe = '',
  [string]$HealthUrl = 'http://127.0.0.1:8787/health',
  [int]$PollSeconds = 10,
  [int]$RestartDelaySeconds = 5,
  [int]$MaxHealthFailures = 3
)

$ErrorActionPreference = 'Stop'

if (-not $NodeExe) {
  $node = Get-Command node -ErrorAction Stop
  $NodeExe = $node.Source
}

$entry = Join-Path $WorkerDir 'src\index.mjs'
if (-not (Test-Path -LiteralPath $entry)) {
  throw "Aquaphoria worker entrypoint not found: $entry"
}

$logDir = Join-Path $WorkerDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$supervisorLog = Join-Path $logDir 'aquaphoria-supervisor.log'
$stdoutLog = Join-Path $logDir 'aquaphoria-worker.out.log'
$stderrLog = Join-Path $logDir 'aquaphoria-worker.err.log'

function Write-SupervisorLog([string]$Message) {
  $line = "{0} {1}" -f (Get-Date).ToString('s'), $Message
  Add-Content -LiteralPath $supervisorLog -Value $line
  Write-Host $line
}

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Global\AquaphoriaDiscordWorkerSupervisor', [ref]$createdNew)
if (-not $createdNew) {
  Write-SupervisorLog 'Another Aquaphoria supervisor instance is already running; exiting.'
  exit 0
}

$child = $null
try {
  Write-SupervisorLog "Supervisor started. WorkerDir=$WorkerDir Node=$NodeExe Health=$HealthUrl"

  while ($true) {
    if (-not $child -or $child.HasExited) {
      if ($child -and $child.HasExited) {
        Write-SupervisorLog "Worker exited with code $($child.ExitCode). Restarting in $RestartDelaySeconds second(s)."
        Start-Sleep -Seconds $RestartDelaySeconds
      }

      $child = Start-Process -FilePath $NodeExe `
        -ArgumentList @($entry) `
        -WorkingDirectory $WorkerDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

      Write-SupervisorLog "Worker started with PID $($child.Id)."
      Start-Sleep -Seconds ([Math]::Max(2, $RestartDelaySeconds))
    }

    $healthFailures = 0
    while (-not $child.HasExited) {
      try {
        $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5
        if ($health.ok -ne $true) { throw 'health endpoint returned ok=false' }
        $healthFailures = 0
      } catch {
        $healthFailures++
        Write-SupervisorLog "Health check failed ($healthFailures/$MaxHealthFailures): $($_.Exception.Message)"
        if ($healthFailures -ge $MaxHealthFailures) {
          Write-SupervisorLog "Worker PID $($child.Id) is unhealthy; restarting it."
          Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
          try { $child.WaitForExit(5000) | Out-Null } catch {}
          break
        }
      }
      Start-Sleep -Seconds $PollSeconds
    }
  }
} finally {
  if ($child -and -not $child.HasExited) {
    Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
  }
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
  Write-SupervisorLog 'Supervisor stopped.'
}
