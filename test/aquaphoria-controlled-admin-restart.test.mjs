import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const restartPath=path.join(root,'tools','restart-aquaphoria-worker-admin.ps1');
const verifyPath=path.join(root,'tools','verify-research-queue-command.mjs');

test('privileged Aquaphoria restart is explicitly gated, targeted and backup-first',()=>{
  assert.equal(existsSync(restartPath),true);
  const text=readFileSync(restartPath,'utf8');
  assert.match(text,/\[switch\]\$Apply/);
  assert.match(text,/WindowsBuiltInRole\]::Administrator/);
  assert.match(text,/Aquaphoria Discord Worker/);
  assert.match(text,/aquaphoria-worker-supervisor\.ps1/);
  assert.match(text,/Copy-Item\s+-LiteralPath\s+\$statePath/);
  assert.match(text,/Stop-ScheduledTask\s+-TaskName\s+\$TaskName/);
  assert.match(text,/Start-ScheduledTask\s+-TaskName\s+\$TaskName/);
  assert.ok(text.indexOf('Copy-Item -LiteralPath $statePath') < text.indexOf('Stop-ScheduledTask -TaskName $TaskName'));
  assert.match(text,/Get-NetTCPConnection.*8790/);
  assert.match(text,/node\.exe/);
  assert.match(text,/verified-queue/i);
  assert.match(text,/if\s*\(-not\s*\$Apply\)/);
});

test('research command verification uses Discord read-only API and requires queue command',()=>{
  assert.equal(existsSync(verifyPath),true);
  const text=readFileSync(verifyPath,'utf8');
  assert.match(text,/Discord.*api\/v10/i);
  assert.match(text,/research-queue/);
  assert.match(text,/method:\s*'GET'/);
  assert.doesNotMatch(text,/method:\s*'(?:POST|PATCH|PUT|DELETE)'/);
  assert.doesNotMatch(text,/console\.log\(.*token/);
});

test('task stop can recover only the identical verified orphaned Node child, never an arbitrary listener',()=>{
  const text=readFileSync(restartPath,'utf8');
  assert.match(text,/if\s*\(-not\s*\$stopped\)\s*\{/);
  assert.match(text,/Stop-Process\s+-Id\s+\$originalPid\s+-Force/);
  assert.match(text,/Get-CimInstance\s+Win32_Process/);
  assert.match(text,/\$child\.ParentProcessId/);
  assert.match(text,/Get-ScheduledTask\s+-TaskName\s+\$TaskName/);
  assert.match(text,/taskStillStopped|taskStopped/);
  assert.match(text,/\$remaining\[0\]\.OwningProcess/);
  assert.match(text,/if\s*\(-not\s*\$stopped\)/);
});
