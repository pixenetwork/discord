import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareShrimpPublicBatch } from './shrimp-public-batch.mjs';
import { publishAquapediaCards } from './aquapedia-posts.mjs';

export const SHRIMP_RELEASE_SOURCE_COMMIT = '2bade20e5a0e80b1c6786c0be6523a2cef92dda7';
const SOURCES = [
  ['breeders.json', 'ee7b644a3ce5bc334e97f8981e7a8f897c92e412f381973a3b869551e2669909'],
  ['competitions.json', '75ef0af6458e73fdcceda503d901fc86077374a7fc97dcbd2bd06bc7b9933f10'],
];

function verifiedReceipt(receipt, id) {
  return Boolean(receipt?.verified === true && receipt.recordId === id
    && /^[A-Za-z0-9_-]{1,100}$/.test(String(receipt.threadId ?? ''))
    && /^[A-Za-z0-9_-]{1,100}$/.test(String(receipt.messageId ?? '')));
}

export async function loadPinnedShrimpRelease({ readSource = async (fileName) =>
  readFile(new URL('../data/shrimp-release/' + fileName, import.meta.url), 'utf8') } = {}) {
  const manifests = [];
  for (const [fileName, expectedDigest] of SOURCES) {
    const text = String(await readSource(fileName)).replace(/\r\n/g, '\n');
    const actualDigest = createHash('sha256').update(text).digest('hex');
    if (actualDigest !== expectedDigest) throw new Error('Shrimp release source checksum mismatch: ' + fileName);
    manifests.push(JSON.parse(text));
  }
  if (manifests[0].discordPublicationApproved !== false
    || manifests[1].publication_status !== 'NOT_POSTED') {
    throw new Error('Shrimp research manifests must remain review-closed');
  }
  const batch = prepareShrimpPublicBatch({
    breederManifest: manifests[0],
    contestManifest: manifests[1],
  });
  if (batch.cards.length !== 22 || batch.discordPublicationApproved !== false) {
    throw new Error('Shrimp release snapshot has unexpected contents or approval');
  }
  return { cards: batch.cards, sourceCommit: SHRIMP_RELEASE_SOURCE_COMMIT, approval: 'CLOSED' };
}

// The live deployment must separately enforce a single owner worker.
// A shared service instance serializes owner commands within that worker.
export function createShrimpReleaseService({
  loadBatch = loadPinnedShrimpRelease,
  publish = publishAquapediaCards,
} = {}) {
  let releaseBusy = false;
  return Object.freeze({
    async run({ mode, guild, store, ownerApproved = false } = {}) {
      if (!['status', 'canary', 'finish'].includes(mode)) {
        throw new Error('Unknown shrimp release command');
      }
      if (!guild?.id || typeof store?.getResearchJob !== 'function'
        || typeof store?.recordResearchJob !== 'function') {
        throw new Error('Guild and persistent research store are required');
      }
      if (releaseBusy) return { stage: 'busy', verifiedCount: 0 };
      releaseBusy = true;
      try {
        const batch = await loadBatch();
        if (!Array.isArray(batch.cards) || batch.cards.length !== 22
          || !batch.sourceCommit || batch.cards[0]?.entityType !== 'breeder') {
          throw new Error('Shrimp release snapshot must contain 14 breeders and 8 competitions');
        }
        const key = 'shrimp-public:' + batch.sourceCommit + ':' + guild.id;
        const existing = await store.getResearchJob(key);
        const receipts = Array.isArray(existing?.discordPublicationReceipts)
          ? existing.discordPublicationReceipts : [];
        const canaryId = batch.cards[0].id;
        const canaryVerified = existing?.sourceCommit === batch.sourceCommit
          && existing?.guildId === guild.id && receipts.some((r) => verifiedReceipt(r, canaryId));
        const complete = canaryVerified && batch.cards.every((card) =>
          receipts.some((r) => verifiedReceipt(r, card.id)));
        if (mode === 'status') return {
          stage: complete ? 'completed' : canaryVerified ? 'canary_verified' : 'not_started',
          verifiedCount: batch.cards.filter((card) => receipts.some((r) => verifiedReceipt(r, card.id))).length,
          total: 22,
          sourceCommit: batch.sourceCommit,
        };
        if (!ownerApproved) return { stage: 'owner_approval_required', verifiedCount: receipts.length };
        if (complete) return { stage: 'completed', verifiedCount: 22, total: 22 };
        if (mode === 'finish' && !canaryVerified) {
          return { stage: 'blocked_canary_required', verifiedCount: 0, total: 22 };
        }
        if (mode === 'canary' && canaryVerified) {
          return { stage: 'canary_verified', verifiedCount: receipts.length, total: 22 };
        }
        const chosen = mode === 'canary' ? batch.cards.slice(0, 1) : batch.cards.slice(1);
        const result = await publish(guild, {
          status: 'completed', discordPublicationApproved: true,
          publicAudienceApproved: true, publicShrimpResearch: true,
          cards: chosen,
        });
        const confirmed = (Array.isArray(result?.receipts) ? result.receipts : [])
          .filter((r) => chosen.some((c) => verifiedReceipt(r, c.id)));
        // An unverified write may have succeeded; never claim it is complete.
        if (mode === 'canary' && (result?.posted !== 1 || confirmed.length !== 1
          || result?.unverified || result?.skipped)) {
          return { stage: 'canary_unverified', verifiedCount: 0, total: 22 };
        }
        const merged = new Map(receipts.map((r) => [r.recordId, r]));
        for (const r of confirmed) merged.set(r.recordId, r);
        const verifiedCount = batch.cards.filter((card) => verifiedReceipt(merged.get(card.id), card.id)).length;
        const allVerified = verifiedCount === 22;
        // Persist actual Discord readback receipts, never synthetic dry-run results.
        if (confirmed.length) {
          await store.recordResearchJob({
            id: key, sourceCommit: batch.sourceCommit, guildId: guild.id,
            status: allVerified ? 'completed' : 'release_in_progress',
            discordPublicationReceipts: [...merged.values()],
            discordPublishedCount: verifiedCount,
            discordUnverifiedCount: Number(result.unverified) || 0,
            discordVerifiedAt: new Date().toISOString(),
            releaseStage: mode === 'canary' ? 'canary_verified'
              : allVerified ? 'completed' : 'partial',
          });
        }
        return mode === 'canary'
          ? { stage: 'canary_verified', verifiedCount: 1, total: 22, receipt: confirmed[0] }
          : { stage: allVerified && result?.posted === 21 && !result.unverified && !result.skipped
              ? 'completed' : 'partial',
            verifiedCount, total: 22,
            unverified: Number(result?.unverified) || 0, skipped: Number(result?.skipped) || 0 };
      } finally {
        releaseBusy = false;
      }
    },
  });
}
