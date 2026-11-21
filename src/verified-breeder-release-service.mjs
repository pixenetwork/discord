import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publishVerifiedBreederPublicBatch, VERIFIED_BREEDER_ROUTES } from './verified-breeder-public-batch.mjs';

// The source is a copy of the reviewer-approved Aquapedia 4-card queue.
// Public posting always requires a fresh, owner-authenticated Discord action.
// Integrity digest of the checked-in review-closed JSON, not an authentication secret.
// The pinned-source and mutation regressions verify this literal checksum.
export const VERIFIED_BREEDER_SOURCE_SHA256 = '627c0befed40d313ad45adc36f407ac61efeb42f3eb86243ee8ae25aea74aee2'; // guardrails-disable-line
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

function publicationClaimFor(batch, guildId, mode, selected) {
  const recordIds = selected.map((card) => card.id);
  const payload = {
    sourceSha256: batch.sourceSha256,
    guildId: String(guildId),
    mode,
    recordIds,
  };
  const claimId = 'breeder-publication:' + createHash('sha256')
    .update(JSON.stringify(payload)).digest('hex');
  return Object.freeze({ claimId, ...payload, recordIds: Object.freeze(recordIds) });
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
          stage: previous.releaseStage === 'needs_manual_review' ? 'manual_review_required'
            : complete ? 'completed' : canaryDone ? 'canary_verified' : count ? 'partial' : 'not_started',
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

        // Cross-process exclusion and crash-safe intent persistence must come
        // from the governed durable authority. The local JSON store intentionally
        // does not synthesize either capability.
        if (typeof store.claimResearchPublicationOnce !== 'function'
          || typeof store.commitResearchPublicationResult !== 'function') {
          return {
            stage: 'publication_claim_required', verifiedCount: count, total: 4,
            reason: 'atomic_publication_claim_required',
          };
        }
        const claim = publicationClaimFor(batch, guild.id, mode, selected);
        const intent = Object.freeze({
          id: key,
          sourceSha256: batch.sourceSha256,
          guildId: guild.id,
          discordPublicationReceipts: Object.freeze([...verified.values()]),
          discordPublishedCount: count,
          releaseStage: 'needs_manual_review',
          publicationClaimId: claim.claimId,
          publicationClaimMode: mode,
          publicationSelectedRecordIds: claim.recordIds,
          publicationClaimStatus: 'in_flight',
        });
        let claimResult = null;
        try {
          claimResult = await store.claimResearchPublicationOnce(claim.claimId, {
            ...claim,
            key,
            intent,
          });
        } catch {
          claimResult = null;
        }
        const claimAccepted = claimResult === true || claimResult?.claimed === true;
        if (!claimAccepted) {
          return {
            stage: 'manual_review_required', verifiedCount: count, total: 4,
            reason: 'publication_claim_replayed_or_unavailable',
          };
        }
        const fence = claimResult && typeof claimResult === 'object'
          && typeof claimResult.fence === 'string' ? claimResult.fence.trim() : '';
        if (!fence) {
          return {
            stage: 'manual_review_required', verifiedCount: count, total: 4,
            reason: 'publication_intent_not_durable',
          };
        }
        let durableIntent;
        try {
          durableIntent = await store.getResearchJob(key);
        } catch {
          durableIntent = null;
        }
        const durableSelected = durableIntent?.publicationSelectedRecordIds;
        const durableIntentMatches = durableIntent
          && durableIntent.id === key
          && durableIntent.sourceSha256 === batch.sourceSha256
          && durableIntent.guildId === guild.id
          && durableIntent.releaseStage === 'needs_manual_review'
          && durableIntent.publicationClaimId === claim.claimId
          && durableIntent.publicationClaimFence === fence
          && durableIntent.publicationClaimMode === mode
          && durableIntent.publicationClaimStatus === 'in_flight'
          && Array.isArray(durableSelected)
          && durableSelected.length === claim.recordIds.length
          && durableSelected.every((id, index) => id === claim.recordIds[index]);
        if (!durableIntentMatches) {
          return {
            stage: 'manual_review_required', verifiedCount: count, total: 4,
            reason: 'publication_intent_not_durable',
          };
        }

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
        const releaseStage = reviewNeeded ? 'needs_manual_review'
          : isComplete ? 'completed' : 'canary_verified';
        const nextRecord = {
          id: key, sourceSha256: batch.sourceSha256, guildId: guild.id,
          discordPublicationReceipts: updated, discordPublishedCount: updated.length,
          discordVerifiedAt: new Date().toISOString(),
          releaseStage,
          publicationClaimId: claim.claimId,
          publicationClaimFence: fence,
          publicationClaimMode: mode,
          publicationSelectedRecordIds: [...claim.recordIds],
          publicationClaimStatus: reviewNeeded ? 'needs_manual_review' : 'committed',
        };
        let resultCommitted = false;
        try {
          resultCommitted = await store.commitResearchPublicationResult(key, nextRecord, {
            claimId: claim.claimId,
            fence,
          });
        } catch {
          resultCommitted = false;
        }
        if (resultCommitted !== true) {
          return {
            stage: 'manual_review_required', verifiedCount: count, total: 4,
            receipts: newReceipts,
            reason: 'publication_result_commit_failed',
          };
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
