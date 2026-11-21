import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const supervisor=readFileSync(path.join(root,'tools/aquaphoria-worker-supervisor.ps1'),'utf8');
const userTask=path.join(root,'tools/install-aquaphoria-worker-user-task.ps1');

test('Aquaphoria supervisor loads the existing local dotenv for every Node restart without printing secrets',()=>{
  assert.match(supervisor,/\$envFile\s*=\s*Join-Path\s+\$WorkerDir\s+'\.env'/i);
  assert.match(supervisor,/Test-Path\s+-LiteralPath\s+\$envFile/i);
  assert.match(supervisor,/--env-file=\$envFile/);
  assert.doesNotMatch(supervisor,/Write-SupervisorLog\s+.*\$env:DISCORD_TOKEN/i);
});

test('non-admin login task is least privileged, idempotent, and never starts a second bot immediately',()=>{
  assert.equal(existsSync(userTask),true,'Expected a dedicated non-admin login task installer');
  const source=readFileSync(userTask,'utf8');
  assert.match(source,/New-ScheduledTaskTrigger\s+-AtLogOn/i);
  assert.match(source,/-LogonType\s+Interactive/i);
  assert.match(source,/-RunLevel\s+Limited/i);
  assert.match(source,/Get-ScheduledTask\s+-TaskName\s+\$TaskName/i);
  assert.doesNotMatch(source,/Start-ScheduledTask/i);
  assert.doesNotMatch(source,/-UserId\s+'SYSTEM'/i);
});
