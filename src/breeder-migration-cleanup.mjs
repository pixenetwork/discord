import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RECEIPT = path.join(ROOT, 'data/breeder-migration/migration-hold-receipt-20261012.json');
const DEFAULT_ARCHIVED = path.join(ROOT, 'data/breeder-migration/archived-thread-metadata-20261012.json');

function normalizeHex(hex) {
  return String(hex ?? '').trim().toLowerCase();
}

function assertBackupParity(receipt) {
  const cloud = receipt.independentCloudBackup ?? {};
  const local = receipt.localMasterBackup ?? {};
  const errors = [];
  if (!cloud.verified) errors.push('independent_cloud_backup_not_verified');
  if (cloud.bytes !== local.bytes) errors.push('cloud_local_byte_mismatch');
  if (normalizeHex(cloud.sha256) !== normalizeHex(local.sha256)) errors.push('cloud_local_sha256_mismatch');
  if (normalizeHex(cloud.md5) !== normalizeHex(local.md5)) errors.push('cloud_local_md5_mismatch');
  if (receipt.deletedChannelCount > 0 && !receipt.irreversibleDeletionExecuted) {
    errors.push('deletion_count_without_execution_flag');
  }
  return errors;
}

function validateArchivedMetadata(archived, receipt) {
  const errors = [];
  if (archived.guildId !== receipt.guildId) errors.push('archived_metadata_guild_mismatch');
  const threads = Array.isArray(archived.archivedThreads) ? archived.archivedThreads : [];
  for (const thread of threads) {
    if (!thread.threadId || !thread.sourceChannelId) errors.push('archived_thread_missing_ids');
    if (thread.messageCount !== 0 || thread.attachmentCount !== 0) {
      errors.push('archived_thread_expected_empty:' + thread.threadId);
    }
  }
  return errors;
}

function validateChannelInventory(receipt) {
  const ids = Array.isArray(receipt.sourceChannelIds) ? receipt.sourceChannelIds : [];
  const unique = new Set(ids.filter(Boolean));
  const errors = [];
  if (unique.size !== ids.length) errors.push('duplicate_source_channel_ids');
  if (ids.length && ids.length !== receipt.movedChannelCount) {
    errors.push('source_channel_inventory_count_mismatch');
  }
  if (receipt.deletedChannelCount > unique.size) errors.push('deleted_exceeds_inventory');
  return { ids: [...unique], errors };
}

/**
 * Offline, credential-free preflight for Migration Hold irreversible cleanup (#20).
 * Never calls Discord; destructive output requires explicit authorization and a complete inventory.
 */
export async function planMigrationHoldCleanup({
  apply = false,
  explicitIrreversibleAuthorization = false,
  receiptPath = DEFAULT_RECEIPT,
  archivedPath = DEFAULT_ARCHIVED,
  readText = readFile,
} = {}) {
  const receipt = JSON.parse(await readText(receiptPath, 'utf8'));
  const archived = JSON.parse(await readText(archivedPath, 'utf8'));
  const blockers = [
    ...assertBackupParity(receipt),
    ...validateArchivedMetadata(archived, receipt),
  ];
  const inventory = validateChannelInventory(receipt);
  blockers.push(...inventory.errors);

  const report = {
    issue: receipt.issue,
    guildId: receipt.guildId,
    migrationHoldCategoryId: receipt.migrationHoldCategoryId,
    movedChannelCount: receipt.movedChannelCount,
    inventoriedChannelCount: inventory.ids.length,
    messageCount: receipt.messageCount,
    attachmentCount: receipt.attachmentCount,
    verifiedForumStrainPosts: receipt.verifiedForumStrainPosts,
    archivedThreadsDocumented: (archived.archivedThreads ?? []).length,
    independentCloudBackupVerified: Boolean(receipt.independentCloudBackup?.verified),
    irreversibleDeletionExecuted: Boolean(receipt.irreversibleDeletionExecuted),
    apply: Boolean(apply),
    explicitIrreversibleAuthorization: Boolean(explicitIrreversibleAuthorization),
    authorized: false,
    blockers,
    plannedDeletes: [],
  };

  if (inventory.ids.length !== receipt.movedChannelCount) {
    blockers.push('source_channel_inventory_incomplete');
  }
  if (!explicitIrreversibleAuthorization) blockers.push('explicit_irreversible_authorization_required');
  if (apply && blockers.length) {
    report.authorized = false;
    report.stage = 'blocked';
    return report;
  }
  if (!apply) {
    report.stage = blockers.length ? 'preflight_blocked' : 'preflight_ready';
    report.authorized = false;
    return report;
  }

  report.plannedDeletes = inventory.ids.map((channelId) => ({
    channelId,
    categoryId: receipt.migrationHoldCategoryId,
    dryRun: false,
  }));
  report.authorized = true;
  report.stage = 'authorized_plan_only';
  return report;
}