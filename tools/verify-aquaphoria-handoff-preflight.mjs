import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPinnedShrimpRelease } from '../src/shrimp-release-service.mjs';
import { planMigrationHoldCleanup } from '../src/breeder-migration-cleanup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function toolPresence() {
  const required = [
    'tools/aquaphoria-worker-supervisor.ps1',
    'tools/install-aquaphoria-worker-task.ps1',
    'tools/install-aquaphoria-worker-user-task.ps1',
    'tools/verify-aquaphoria-worker.ps1',
    'tools/restart-aquaphoria-worker-admin.ps1',
    'tools/verify-shrimp-public-batch.mjs',
    'tools/verify-shrimp-batch-e2e.mjs',
    'docs/AQUAPHORIA_CONTROLLED_LIVE_WORKER_HANDOFF.md',
    'docs/SHRIMPAPEDIA_PUBLIC_DISCORD_RELEASE.md',
    'docs/WINDOWS_PERSISTENT_WORKER.md',
    'docs/AQUAPHORIA_CONTROLLED_ADMIN_RESTART.md',
  ];
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  return { missing, complete: missing.length === 0 };
}

async function shrimpSnapshotGate() {
  const batch = await loadPinnedShrimpRelease();
  return {
    cards: batch.cards.length,
    breeders: batch.cards.filter((c) => c.entityType === 'breeder').length,
    contests: batch.cards.filter((c) => c.entityType === 'competition').length,
    sourceCommit: batch.sourceCommit,
    approval: batch.approval,
    approvalClosed: batch.approval === 'CLOSED',
  };
}

async function migrationGate() {
  return planMigrationHoldCleanup({ apply: false, explicitIrreversibleAuthorization: false });
}

const tools = toolPresence();
const shrimp = await shrimpSnapshotGate();
const migration = await migrationGate();

const liveGates = [
  'verified_worker_launch_path',
  'single_instance_cutover',
  'public_shrimp_forum_permissions',
  'owner_canary_discord_receipt',
  'remaining_21_batch_receipts',
];
const releaseReady = tools.complete
  && shrimp.cards === 22
  && shrimp.approval === 'CLOSED'
  && migration.independentCloudBackupVerified;

const result = {
  offlinePreflight: true,
  issue22WorkerHandoff: {
    toolingComplete: tools.complete,
    missingTooling: tools.missing,
    pinnedShrimpSnapshot: shrimp,
    releaseReadyForControlledHandoff: releaseReady,
    liveGatesStillRequired: liveGates,
    verifiedDiscordPosts: 0,
    targetDiscordPosts: 22,
  },
  issue20MigrationCleanup: {
    stage: migration.stage,
    blockers: migration.blockers,
    inventoriedChannelCount: migration.inventoriedChannelCount,
    movedChannelCount: migration.movedChannelCount,
    cloudBackupVerified: migration.independentCloudBackupVerified,
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!tools.complete || shrimp.cards !== 22) process.exit(2);
process.exit(0);