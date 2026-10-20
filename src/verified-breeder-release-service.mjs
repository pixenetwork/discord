import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publishVerifiedBreederPublicBatch, VERIFIED_BREEDER_ROUTES } from './verified-breeder-public-batch.mjs';

// The source is a copy of the reviewer-approved Aquapedia 4-card queue.
// Public posting always requires a fresh, owner-authenticated Discord action.
export const VERIFIED_BREEDER_SOURCE_SHA256 = '627c0befed40d313ad45adc36f407ac61efeb42f3eb86243ee8ae25aea74aee2';
const IDS = [
  'verified-savanna-2026-elsa-and-show',
  'verified-tarumi-2026-kuro-rintou',
  'verified-larmax-2026-rili',
  'verified-skyfish-2018-galaxy',
];
const idCheck = (v) => /^\d{15,22}$/.test(String(v ?? ''));

export async function loadPinnedVerifiedBreeders({
  readSource = async () => readFile(new URL('../data/verified-breeder-public-batch-20261020.json', import.meta.url), 'utf8'),
} = {}) {
  const raw = String(await readSource()).replace(/\r\n/g, '\n');
  const actual = createHash('sha256').update(raw).digest('hex');
  if (actual !== VERIFIED_BREEDER_SOURCE_SHA256) throw Error('Verified breeder source checksum mismatch');
  const batch = JSON.parse(raw);
  if (batch.publicationStatus !== 'NOT_POSTED_AUTHENTICATED_PUBLISHER_REQUIRED'
    || batch.discordPublicationApproved !== false
    || batch.publisherRouting?.publicAudienceApproved !== false
    || batch.publisherRouting?.releaseStatus !== 'NOT_DISPATCHED'
    || batch.receiptState?.posted !== 0
    || batch.cards?.length !== 4
    || IDS.some((id, i) => batch.cards[i]?.id !== id)) {
    throw Error('Verified breeder source must remain review-closed with exactly four expected cards');
  }
  for (const card of batch.cards) {
    const pinned = VERIFIED_BREEDER_ROUTES[card.id];
    const route = batch.publisherRouting.targetRoutes[card.id];
    if (!pinned || !route || route.forum !== pinned.forum
      || route.mode !== pinned.mode || route.breederKey !== pinned.breederKey
      || card.photos?.length !== 0 || !Array.isArray(card.sources)
      || card.sources.length < 1 || card.sources.some((s) => typeof s !== 'string' || !s.startsWith('https://'))) {
      throw Error('Unreviewed breeder route, rights, or source in pinned release');
    }
  }
  return Object.freeze({
    sourceSha256: actual, cards: Object.freeze(batch.cards),
    routes: VERIFIED_BREEDER_ROUTES,
    sourceStatus: 'REVIEW_CLOSED',
  });
}

function validReceipt(receipt, id) {
  return Boolean(receipt?.verified === true && receipt.recordId === id
    && idCheck(receipt.threadId) && idCheck(receipt.messageId));
}
export function createVerifiedBreederReleaseService({
  loadBatch = loadPinnedVerifiedBreeders,
  publish = publishVerifiedBreederPublicBatch,
} = {}) {
  let busy = false;
  return Object.freeze({
    async run({ mode, guild, store, ownerApproved = false } = {}) {
      if (!['status', 'canary', 'finish'].includes(mode)) throw Error('Unknown breeder evidence release mode');
      if (!guild?.id || !store?.getResearchJob || !store?.recordResearchJob) throw Error('Guild and durable research store required');
      if (busy) return { stage: 'busy', verifiedCount: 0, total: 4 };
      busy = true;
      try {
        const batch = await loadBatch();
        if (!batch?.sourceSha256 || batch.cards?.length !== 4) throw Error('Missing pinned source');
        const key = 'breeder-social-public:' + batch.sourceSha256 + ':' + guild.id;
        const previous = await store.getResearchJob(key) ?? {};
        if (previous.guildId && previous.guildId !== guild.id) throw Error('Breeder release guild mismatch');
        const allReceipts = Array.isArray(previous.discordPublicationReceipts)
          ? previous.discordPublicationReceipts : [];
        const verified = new Map();
        for (const card of batch.cards) {
          const found = allReceipts.filter((entry) => validReceipt(entry, card.id));
          if (found.length > 1) throw Error('Conflicting breeder release receipts');
          if (found.length === 1) verified.set(card.id, found[0]);
        }
        const count = verified.size;
        const complete = count === 4;
        const canaryDone = verified.has(IDS[0]);
        const status = {
          stage: complete ? 'completed' : canaryDone ? 'canary_verified' : 'not_started',
          verifiedCount: count, total: 4, sourceSha256: batch.sourceSha256,
        };
        if (mode === 'status') return status;
        if (!ownerApproved) return { stage: 'owner_approval_required', verifiedCount: count, total: 4 };
        if (previous.releaseStage === 'needs_manual_review') return { stage: 'manual_review_required', verifiedCount: count, total: 4 };
        if (complete) return status;
        if (mode === 'finish' && !canaryDone) return { stage: 'blocked_canary_required', verifiedCount: count, total: 4 };
        if (mode === 'canary' && canaryDone) return status;
        const selected = mode === 'canary' ? batch.cards.slice(0, 1)
          : batch.cards.filter((c) => !verified.has(c.id));
        if (mode === 'finish' && selected.some((c) => c.id === IDS[0])) throw Error('Canary was not verified');
        const result = await publish(guild, {
          status: 'completed',
          ownerApproved: true, discordPublicationApproved: true,
          publicAudienceApproved: true,
          cards: selected, routes: batch.routes,
        });
        const newReceipts = Array.isArray(result?.receipts)
          ? result.receipts.filter((r) => selected.some((c) => validReceipt(r, c.id))) : [];
        const unique = new Set(newReceipts.map((x) => x.recordId));
        const suspicious = newReceipts.length !== unique.size
          || (result?.posted ?? 0) !== newReceipts.length
          || result?.reason === 'write_readback_mismatch_stop_no_retry'
          || result?.reason === 'write_unverified_stop_no_retry'
          || result?.reason === 'discord_send_failed_or_uncertain'
          || result?.reason === 'discord_create_failed_or_uncertain'
          || result?.reason === 'starter_readback_failed_stop_no_retry'
          || result?.reason === 'starter_readback_mismatch_stop_no_retry';
        for (const r of newReceipts) verified.set(r.recordId, r);
        const updated = [...verified.values()];
        const isComplete = updated.length === 4;
        const fullyVerified = newReceipts.length === selected.length
          && !result?.skipped && !suspicious;
        const reviewNeeded = suspicious || (newReceipts.length !== selected.length)
          || Boolean(result?.skipped);
        if (newReceipts.length || reviewNeeded) {
          await store.recordResearchJob({
            id: key, sourceSha256: batch.sourceSha256, guildId: guild.id,
            discordPublicationReceipts: updated, discordPublishedCount: updated.length,
            discordVerifiedAt: new Date().toISOString(),
            releaseStage: reviewNeeded ? 'needs_manual_review'
              : isComplete ? 'completed' : 'canary_verified',
          });
        }
        return {
          stage: reviewNeeded ? 'manual_review_required'
            : isComplete && fullyVerified ? 'completed'
              : mode === 'canary' && fullyVerified ? 'canary_verified' : 'partial',
          verifiedCount: updated.length, total: 4,
          receipts: newReceipts,
          reason: result?.reason ?? null,
        };
      } finally {
        busy = false;
      }
    },
  });
}
