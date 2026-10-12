import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const verifier = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tools/verify-aquaphoria-worker.ps1');
const winOnly = { skip: process.platform !== 'win32' ? 'Requires Windows PowerShell' : false };

function runVerifier({ initialized, failed, gpt, readyHttpError = false }) {
  const script = [
    "function Get-ScheduledTask { [CmdletBinding()] param([string]$TaskName) [pscustomobject]@{State='Running'} }",
    "function Get-ScheduledTaskInfo { [CmdletBinding()] param([string]$TaskName) [pscustomobject]@{LastTaskResult=0;LastRunTime=(Get-Date);NextRunTime=(Get-Date)} }",
    "function Invoke-RestMethod {",
    "  [CmdletBinding()] param([string]$Uri,[string]$Method,[int]$TimeoutSec)",
    "  if($Uri -match '/ready$'){",
    "    if(" + (readyHttpError ? '$true' : '$false') + "){throw '503 readiness'}",
    "    [pscustomobject]@{ok=" + (initialized && !failed ? '$true' : '$false') + ";initialized=" + (initialized ? '$true' : '$false') + ";startupFailed=" + (failed ? '$true' : '$false') + ";service='aquaphoria-discord'}",
    "  }else{ [pscustomobject]@{ok=$true;gptConfigured=" + (gpt ? '$true' : '$false') + ";service='aquaphoria-discord'} }",
    "}",
    "& '" + verifier.replaceAll("'", "''") + "'",
  ].join('\n');
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
}

test('Windows deployment verifier distinguishes gateway liveness from full startup readiness', winOnly, () => {
  const healthy = runVerifier({ initialized: true, failed: false, gpt: true });
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.match(healthy.stdout, /"workerReady":\s*true/);

  const failedBootstrap = runVerifier({ initialized: false, failed: true, gpt: true });
  assert.notEqual(failedBootstrap.status, 0, failedBootstrap.stderr + '\nSTDOUT:\n' + failedBootstrap.stdout);
  assert.match(failedBootstrap.stdout, /"gatewayConnected":\s*true/);
  assert.match(failedBootstrap.stdout, /"workerReady":\s*false/);

  const unavailable = runVerifier({ initialized: false, failed: false, gpt: true, readyHttpError: true });
  assert.notEqual(unavailable.status, 0, unavailable.stderr);

  const missingGptKey = runVerifier({ initialized: true, failed: false, gpt: false });
  assert.notEqual(missingGptKey.status, 0, missingGptKey.stderr);
  assert.match(missingGptKey.stdout, /"workerReady":\s*true/);
});
