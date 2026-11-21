import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadPinnedShrimpRelease } from '../src/shrimp-release-service.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('controlled live worker handoff checklist documents one-writer and receipt gates', () => {
  const doc = path.join(root, 'docs/AQUAPHORIA_CONTROLLED_LIVE_WORKER_HANDOFF.md');
  assert.equal(existsSync(doc), true);
  const text = readFileSync(doc, 'utf8');
  assert.match(text, /issue #22/i);
  assert.match(text, /One writer|one writer/i);
  assert.match(text, /0\/22/);
  assert.match(text, /verify-aquaphoria-handoff-preflight/);
  assert.match(text, /shrimp-release/);
  assert.match(text, /restart-aquaphoria-worker-admin/);
  assert.match(text, /workerReady/);
  assert.doesNotMatch(text, /auto-publish|automatic publish/i);
});

test('handoff preflight tool reports closed approval and missing live gates without credentials', () => {
  const tool = path.join(root, 'tools/verify-aquaphoria-handoff-preflight.mjs');
  const run = spawnSync(process.execPath, [tool], { encoding: 'utf8', cwd: root });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.offlinePreflight, true);
  assert.equal(payload.issue22WorkerHandoff.pinnedShrimpSnapshot.cards, 22);
  assert.equal(payload.issue22WorkerHandoff.pinnedShrimpSnapshot.approval, 'CLOSED');
  assert.equal(payload.issue22WorkerHandoff.verifiedDiscordPosts, 0);
  assert.ok(Array.isArray(payload.issue22WorkerHandoff.liveGatesStillRequired));
  assert.ok(payload.issue22WorkerHandoff.liveGatesStillRequired.length >= 3);
});

test('pinned shrimp snapshot remains checksum-locked for handoff', async () => {
  const batch = await loadPinnedShrimpRelease();
  assert.equal(batch.cards.length, 22);
  assert.equal(batch.approval, 'CLOSED');
});

test('supervisor and restart tooling preserve fail-closed cutover semantics', () => {
  const supervisor = readFileSync(path.join(root, 'tools/aquaphoria-worker-supervisor.ps1'), 'utf8');
  const restart = readFileSync(path.join(root, 'tools/restart-aquaphoria-worker-admin.ps1'), 'utf8');
  assert.match(supervisor, /--env-file=/);
  assert.match(restart, /\[switch\]\$Apply/);
  assert.match(restart, /PREVIEW_ONLY/);
  assert.ok(restart.indexOf('Copy-Item') < restart.indexOf('Stop-ScheduledTask'));
});