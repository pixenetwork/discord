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
  const store = {
    async getResearchJob(key) { return state.get(key) ?? null; },
    async recordResearchJob(r) { if (!r?.id) throw Error('Record id missing'); state.set(r.id, { ...r }); },
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
