import test from 'node:test';
import assert from 'node:assert/strict';
import { planMigrationHoldCleanup } from '../src/breeder-migration-cleanup.mjs';

test('default migration cleanup preflight is blocked without channel inventory or owner authorization', async () => {
  const report = await planMigrationHoldCleanup();
  assert.equal(report.authorized, false);
  assert.equal(report.inventoriedChannelCount, 0);
  assert.equal(report.movedChannelCount, 31);
  assert.equal(report.independentCloudBackupVerified, true);
  assert.ok(report.blockers.includes('source_channel_inventory_incomplete'));
  assert.ok(report.blockers.includes('explicit_irreversible_authorization_required'));
  assert.equal(report.plannedDeletes.length, 0);
});

test('apply stays blocked until inventory is complete even with owner authorization flag', async () => {
  const partial = await planMigrationHoldCleanup({
    apply: true,
    explicitIrreversibleAuthorization: true,
  });
  assert.equal(partial.authorized, false);
  assert.equal(partial.stage, 'blocked');
  assert.equal(partial.plannedDeletes.length, 0);
});

test('complete inventory without apply yields preflight_ready but still not authorized', async () => {
  const receipt = JSON.parse(JSON.stringify(await import('../data/breeder-migration/migration-hold-receipt-20261012.json', { with: { type: 'json' } }).then((m) => m.default)));
  receipt.sourceChannelIds = Array.from({ length: 31 }, (_, i) => String(1559261000000000000n + BigInt(i)));
  const archived = await import('../data/breeder-migration/archived-thread-metadata-20261012.json', { with: { type: 'json' } }).then((m) => m.default);
  const readText = async (p) => {
    if (p.includes('migration-hold-receipt')) return JSON.stringify(receipt);
    if (p.includes('archived-thread-metadata')) return JSON.stringify(archived);
    throw new Error('unexpected path ' + p);
  };
  const ready = await planMigrationHoldCleanup({
    readText,
    explicitIrreversibleAuthorization: false,
    apply: false,
  });
  assert.equal(ready.inventoriedChannelCount, 31);
  assert.equal(ready.stage, 'preflight_blocked');
  assert.ok(ready.blockers.includes('explicit_irreversible_authorization_required'));
});

test('authorized plan only emits when inventory, backups, and flags align', async () => {
  const receipt = JSON.parse(JSON.stringify(await import('../data/breeder-migration/migration-hold-receipt-20261012.json', { with: { type: 'json' } }).then((m) => m.default)));
  receipt.sourceChannelIds = Array.from({ length: 31 }, (_, i) => String(1559261000000000000n + BigInt(i)));
  const archived = await import('../data/breeder-migration/archived-thread-metadata-20261012.json', { with: { type: 'json' } }).then((m) => m.default);
  const readText = async (p) => {
    if (p.includes('migration-hold-receipt')) return JSON.stringify(receipt);
    if (p.includes('archived-thread-metadata')) return JSON.stringify(archived);
    throw new Error('unexpected path ' + p);
  };
  const plan = await planMigrationHoldCleanup({
    readText,
    explicitIrreversibleAuthorization: true,
    apply: true,
  });
  assert.equal(plan.authorized, true);
  assert.equal(plan.stage, 'authorized_plan_only');
  assert.equal(plan.plannedDeletes.length, 31);
  assert.equal(plan.plannedDeletes[0].dryRun, false);
});

test('backup checksum mismatch fails closed', async () => {
  const receipt = JSON.parse(JSON.stringify(await import('../data/breeder-migration/migration-hold-receipt-20261012.json', { with: { type: 'json' } }).then((m) => m.default)));
  receipt.localMasterBackup.sha256 = 'deadbeef';
  const archived = await import('../data/breeder-migration/archived-thread-metadata-20261012.json', { with: { type: 'json' } }).then((m) => m.default);
  const readText = async (p) => {
    if (p.includes('migration-hold-receipt')) return JSON.stringify(receipt);
    if (p.includes('archived-thread-metadata')) return JSON.stringify(archived);
    throw new Error('unexpected path ' + p);
  };
  const report = await planMigrationHoldCleanup({ readText });
  assert.ok(report.blockers.includes('cloud_local_sha256_mismatch'));
});