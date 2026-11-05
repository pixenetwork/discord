import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPinnedVerifiedBreeders, createVerifiedBreederReleaseService,
  VERIFIED_BREEDER_SOURCE_SHA256 } from '../src/verified-breeder-release-service.mjs';

const source = readFileSync(new URL('../data/verified-breeder-public-batch-20261020.json', import.meta.url), 'utf8');
const loadBatch = () => loadPinnedVerifiedBreeders({ readSource: async () => source });
const guild = { id: '123456789012345678', client: { user: { id: '123456789012345679' } } };

function sandbox(resultFactory) {
  const state = new Map();
  const calls = [];
  const service = createVerifiedBreederReleaseService({
    loadBatch,
    async publish(currentGuild, request) {
      calls.push({ guild: currentGuild, request });
      if (resultFactory) return resultFactory(currentGuild, request, calls.length);
      const receipts = request.cards.map((card, i) => ({
        recordId: card.id, threadId: String(123456789012345680n + BigInt(i)),
        messageId: String(123456789012345690n + BigInt(calls.length * 10 + i)),
        verified: true,
      }));
      return { posted: receipts.length, skipped: 0, receipts, reason: 'verified_readback_receipts' };
    }
  });
  let fenceSequence = 0;
  const activeClaims = new Set();
  const store = {
    async getResearchJob(key) { return state.get(key) ?? null; },
    async recordResearchJob(r) { if (!r?.id) throw Error('Record id missing'); state.set(r.id, { ...r }); },
    async claimResearchPublicationOnce(claimId, claim) {
      if (!claim?.key || !claim?.intent || activeClaims.has(claimId)) {
        return { claimed: false, reason: 'replayed_or_unavailable' };
      }
      const current = state.get(claim.key);
      if (current?.releaseStage === 'needs_manual_review') {
        return { claimed: false, reason: 'manual_review_required' };
      }
      activeClaims.add(claimId);
      const fence = 'fence-' + (++fenceSequence);
      state.set(claim.key, {
        ...claim.intent,
        publicationClaimFence: fence,
      });
      return { claimed: true, fence };
    },
    async commitResearchPublicationResult(key, record, { claimId, fence } = {}) {
      const current = state.get(key);
      if (!current || current.publicationClaimId !== claimId
        || current.publicationClaimFence !== fence
        || current.publicationClaimStatus !== 'in_flight') return false;
      state.set(key, {
        ...record,
        publicationClaimId: claimId,
        publicationClaimFence: fence,
        publicationClaimStatus: 'committed',
      });
      return true;
    },
  };
  return { service, store, state, calls };
}

test('the exact source snapshot is pinned and review-closed', async () => {
  const loaded = await loadBatch();
  assert.equal(loaded.sourceSha256, VERIFIED_BREEDER_SOURCE_SHA256);
  assert.equal(loaded.cards.length, 4);
  assert.equal(loaded.sourceStatus, 'REVIEW_CLOSED');
  assert.equal(loaded.cards[0].id, 'verified-savanna-2026-elsa-and-show');
  assert.equal(loaded.routes[loaded.cards[1].id].mode, 'existing_only');
});

test('changed publication metadata is rejected before touching Discord', async () => {
  const changed = source.replace('"discordPublicationApproved": false', '"discordPublicationApproved": true');
  assert.notEqual(changed, source);
  await assert.rejects(loadPinnedVerifiedBreeders({ readSource: async () => changed }), /checksum/);
});

test('status and missing owner approval never call the publishing client', async () => {
  const x=sandbox();
  const status=await x.service.run({mode:'status',guild,store:x.store});
  assert.equal(status.stage,'not_started');
  assert.equal(status.verifiedCount,0);
  const unapproved=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:false});
  assert.equal(unapproved.stage,'owner_approval_required');
  assert.equal(x.calls.length,0);
});

test('finish cannot run until canary receipt exists', async () => {
  const x=sandbox();
  const r=await x.service.run({mode:'finish',guild,store:x.store,ownerApproved:true});
  assert.equal(r.stage,'blocked_canary_required');
  assert.equal(x.calls.length,0);
});

test('canary and finish store exactly four verified Discord receipts', async () => {
  const x=sandbox();
  const first=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(first.stage,'canary_verified');
  assert.equal(first.verifiedCount,1);
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].request.cards.length,1);
  assert.deepEqual(x.calls[0].request.cards.map(c=>c.id),['verified-savanna-2026-elsa-and-show']);
  assert.equal(x.calls[0].request.ownerApproved,true);
  const status=await x.service.run({mode:'status',guild,store:x.store});
  assert.equal(status.stage,'canary_verified');
  const end=await x.service.run({mode:'finish',guild,store:x.store,ownerApproved:true});
  assert.equal(end.stage,'completed');
  assert.equal(end.verifiedCount,4);
  assert.equal(x.calls[1].request.cards.length,3);
  assert.equal(x.state.size,1);
  const storeValue=[...x.state.values()][0];
  assert.equal(storeValue.discordPublicationReceipts.length,4);
  assert.equal(storeValue.releaseStage,'completed');
  const repeat=await x.service.run({mode:'finish',guild,store:x.store,ownerApproved:true});
  assert.equal(repeat.stage,'completed');
  assert.equal(x.calls.length,2);
});

test('an uncertain Discord write blocks retries rather than claiming a receipt', async()=>{
  const x=sandbox(()=>({posted:0,skipped:0,receipts:[],reason:'write_unverified_stop_no_retry'}));
  const r=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(r.stage,'manual_review_required');
  assert.equal(r.verifiedCount,0);
  const retry=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(retry.stage,'manual_review_required');
  assert.equal(x.calls.length,1);
});

test('non-numeric fake receipts cannot count as real Discord messages', async()=>{
  const x=sandbox((g,request)=>({
    posted:1,skipped:0,reason:'verified_readback_receipts',
    receipts:[{recordId:request.cards[0].id,threadId:'thread-fake',messageId:'message-fake',verified:true}],
  }));
  const r=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(r.stage,'manual_review_required');
  assert.equal(r.verifiedCount,0);
});

test('partial second-phase posting preserves valid receipts but halts retries', async()=>{
  const x=sandbox((g,request,count)=>{
    const cards=count===1?request.cards:request.cards.slice(0,1);
    const receipts=cards.map((card,i)=>({
      recordId:card.id,threadId:'123456789012345681',
      messageId:'12345678901234569'+String(count)+String(i),
      verified:true,
    }));
    return {posted:receipts.length,skipped: count===2?2:0,receipts,reason:'verified_readback_receipts'};
  });
  const first=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(first.stage,'canary_verified');
  const finish=await x.service.run({mode:'finish',guild,store:x.store,ownerApproved:true});
  assert.equal(finish.stage,'manual_review_required');
  assert.equal(finish.verifiedCount,2);
  assert.equal(x.calls.length,2);
  const retry=await x.service.run({mode:'finish',guild,store:x.store,ownerApproved:true});
  assert.equal(retry.stage,'manual_review_required');
  assert.equal(x.calls.length,2);
});

test('persisted release receipts cannot cross guild boundaries',async()=>{
  const x=sandbox();
  await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  const key=[...x.state.keys()][0];
  const old=x.state.get(key);x.state.set(key,{...old,guildId:'999999999999999999'});
  await assert.rejects(()=>x.service.run({mode:'status',guild,store:x.store}),/guild mismatch/);
});

test('concurrent owner actions are serialized per service instance',async()=>{
  let release;
  let wake;
  const gate=new Promise((resolve)=>wake=resolve);
  const x=sandbox(async(g,request)=>{
    await gate;
    return {posted:1,skipped:0,reason:'verified_readback_receipts',receipts:[{
      recordId:request.cards[0].id,threadId:'123456789012345681',messageId:'123456789012345693',verified:true,
    }]};
  });
  const pending=x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  await new Promise(resolve=>setTimeout(resolve,10));
  const blocked=await x.service.run({mode:'canary',guild,store:x.store,ownerApproved:true});
  assert.equal(blocked.stage,'busy');
  wake();
  await pending;
  assert.equal(x.calls.length,1);
});

test('status preserves persisted manual-review holds regardless of receipt count', async () => {
  const batch = await loadBatch();
  for (const count of [0, 1, 4]) {
    const x = sandbox();
    const record = {
      id: 'breeder-social-public:' + batch.sourceSha256 + ':' + guild.id,
      guildId: guild.id,
      releaseStage: 'needs_manual_review',
      discordPublicationReceipts: batch.cards.slice(0, count).map((card, i) => ({
        recordId: card.id,
        threadId: String(123456789012345680n + BigInt(i)),
        messageId: String(123456789012345690n + BigInt(i)),
        verified: true,
      })),
    };
    x.state.set(record.id, record);
    const before = JSON.stringify([...x.state.entries()]);
    const status = await x.service.run({ mode: 'status', guild, store: x.store });
    assert.equal(status.stage, 'manual_review_required', 'receipt count ' + count);
    assert.equal(status.verifiedCount, count);
    assert.equal(status.sourceSha256, batch.sourceSha256);
    assert.equal(x.calls.length, 0);
    assert.equal(JSON.stringify([...x.state.entries()]), before);
  }
});

test('status reports partial receipts without a canary and finish stays blocked', async () => {
  const batch = await loadBatch();
  const x = sandbox();
  const record = {
    id: 'breeder-social-public:' + batch.sourceSha256 + ':' + guild.id,
    guildId: guild.id,
    discordPublicationReceipts: [{
      recordId: batch.cards[1].id,
      threadId: '123456789012345681',
      messageId: '123456789012345691',
      verified: true,
    }],
  };
  x.state.set(record.id, record);
  const status = await x.service.run({ mode: 'status', guild, store: x.store });
  assert.equal(status.stage, 'partial');
  assert.equal(status.verifiedCount, 1);
  const finish = await x.service.run({ mode: 'finish', guild, store: x.store, ownerApproved: true });
  assert.equal(finish.stage, 'blocked_canary_required');
  assert.equal(x.calls.length, 0);
});


test('separate release-service instances require one shared atomic claim before publishing', async () => {
  const state = new Map();
  const claimed = new Set();
  let reads = 0;
  let releaseReads;
  const readsReady = new Promise((resolve) => { releaseReads = resolve; });
  const store = {
    async getResearchJob(key) {
      reads += 1;
      if (reads === 2) releaseReads();
      await readsReady;
      return state.get(key) ?? null;
    },
    async recordResearchJob(record) {
      state.set(record.id, { ...record });
    },
    async claimResearchPublicationOnce(claimId, claim) {
      if (claimed.has(claimId)) return { claimed: false };
      claimed.add(claimId);
      const fence = 'shared-fence-' + claimed.size;
      state.set(claim.key, {
        ...claim.intent,
        publicationClaimFence: fence,
      });
      return { claimed: true, fence };
    },
    async commitResearchPublicationResult(key, record, { claimId, fence } = {}) {
      const current = state.get(key);
      if (!current || current.publicationClaimId !== claimId
        || current.publicationClaimFence !== fence
        || current.publicationClaimStatus !== 'in_flight') return false;
      state.set(key, {
        ...record,
        publicationClaimId: claimId,
        publicationClaimFence: fence,
        publicationClaimStatus: 'committed',
      });
      return true;
    },
  };
  let publishCalls = 0;
  const publish = async (currentGuild, request) => {
    publishCalls += 1;
    const card = request.cards[0];
    return {
      posted: 1, skipped: 0, reason: 'verified_readback_receipts',
      receipts: [{
        recordId: card.id,
        threadId: '123456789012345681',
        messageId: String(123456789012345693n + BigInt(publishCalls)),
        verified: true,
      }],
    };
  };
  const first = createVerifiedBreederReleaseService({ loadBatch, publish });
  const second = createVerifiedBreederReleaseService({ loadBatch, publish });
  const results = await Promise.all([
    first.run({ mode: 'canary', guild, store, ownerApproved: true }),
    second.run({ mode: 'canary', guild, store, ownerApproved: true }),
  ]);
  assert.equal(publishCalls, 1, 'only the durable-claim winner may enter publish');
  assert.equal(results.filter((result) => result.stage === 'canary_verified').length, 1);
  assert.equal(results.filter((result) => result.stage === 'manual_review_required').length, 1);
});

test('missing atomic publication claim capability blocks canary before publish', async () => {
  const state = new Map();
  let publishCalls = 0;
  const store = {
    async getResearchJob(key) { return state.get(key) ?? null; },
    async recordResearchJob(record) { state.set(record.id, { ...record }); },
  };
  const service = createVerifiedBreederReleaseService({
    loadBatch,
    async publish() {
      publishCalls += 1;
      return { posted: 0, skipped: 0, receipts: [], reason: 'unexpected_publish' };
    },
  });
  const result = await service.run({ mode: 'canary', guild, store, ownerApproved: true });
  assert.equal(result.stage, 'publication_claim_required');
  assert.equal(result.reason, 'atomic_publication_claim_required');
  assert.equal(publishCalls, 0);
});

test('atomic publication claim must durably persist a fenced intent before Discord publish', async () => {
  let publishCalls = 0;
  const store = {
    async getResearchJob() { return null; },
    async recordResearchJob() {},
    async claimResearchPublicationOnce() { return true; },
    async commitResearchPublicationResult() { return true; },
  };
  const service = createVerifiedBreederReleaseService({
    loadBatch,
    async publish() {
      publishCalls += 1;
      return { posted: 0, skipped: 0, receipts: [], reason: 'unexpected_publish' };
    },
  });
  const result = await service.run({ mode: 'canary', guild, store, ownerApproved: true });
  assert.equal(result.stage, 'manual_review_required');
  assert.equal(result.reason, 'publication_intent_not_durable');
  assert.equal(publishCalls, 0);
});

test('fenced result commit failure leaves restart-safe manual-review hold', async () => {
  const batch = await loadBatch();
  const key = 'breeder-social-public:' + batch.sourceSha256 + ':' + guild.id;
  const state = new Map();
  let publishCalls = 0;
  const store = {
    async getResearchJob(id) { return state.get(id) ?? null; },
    async recordResearchJob(record) { state.set(record.id, { ...record }); },
    async claimResearchPublicationOnce(claimId, claim) {
      const fence = 'commit-failure-fence';
      state.set(claim.key, { ...claim.intent, publicationClaimFence: fence });
      return { claimed: true, fence };
    },
    async commitResearchPublicationResult() { return false; },
  };
  const publish = async (_currentGuild, request) => {
    publishCalls += 1;
    return {
      posted: 1, skipped: 0, reason: 'verified_readback_receipts',
      receipts: [{
        recordId: request.cards[0].id,
        threadId: '123456789012345681',
        messageId: '123456789012345693',
        verified: true,
      }],
    };
  };
  const service = createVerifiedBreederReleaseService({ loadBatch, publish });
  const first = await service.run({ mode: 'canary', guild, store, ownerApproved: true });
  assert.equal(first.stage, 'manual_review_required');
  assert.equal(first.reason, 'publication_result_commit_failed');
  assert.equal(publishCalls, 1);
  assert.equal(state.get(key)?.releaseStage, 'needs_manual_review');
  assert.equal(state.get(key)?.publicationClaimStatus, 'in_flight');

  const fresh = createVerifiedBreederReleaseService({ loadBatch, publish });
  const status = await fresh.run({ mode: 'status', guild, store });
  assert.equal(status.stage, 'manual_review_required');
  const retry = await fresh.run({ mode: 'canary', guild, store, ownerApproved: true });
  assert.equal(retry.stage, 'manual_review_required');
  assert.equal(publishCalls, 1);
});
