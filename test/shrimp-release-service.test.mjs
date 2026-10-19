import test from 'node:test';
import assert from 'node:assert/strict';
import { createShrimpReleaseService, loadPinnedShrimpRelease } from '../src/shrimp-release-service.mjs';
import { createCommandRouter } from '../src/commands.mjs';
import { createStore } from '../src/store.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const entries = [
  { id:'shrimp-breeder-0', name:'First breeder', entityType:'breeder' },
  ...Array.from({length:13},(_,i)=>({id:'shrimp-breeder-'+(i+1),name:'Breeder '+(i+1),entityType:'breeder'})),
  ...Array.from({length:8},(_,i)=>({id:'shrimp-contest-'+i,name:'Contest '+i,entityType:'competition'})),
];
const sourceTag='source-sha-example';
function harness({ failWrite=false, unverified=false }={}) {
  const writes=[],jobs=new Map(),attempts=[];
  const store={
    async getResearchJob(id){return jobs.get(id)||null;},
    async recordResearchJob(job){if(failWrite)throw new Error('Persistent state unavailable');writes.push(job);const next={...jobs.get(job.id),...job};jobs.set(job.id,next);return next;}
  };
  const publish=async (_guild,payload)=>{
    attempts.push(payload);
    const receipts=payload.cards.map((c,i)=>({recordId:c.id,threadId:'t-'+c.id,messageId:'m-'+c.id,verified:true}));
    return unverified?{posted:0,receipts:[],unverified:1,skipped:0}: {posted:payload.cards.length,receipts,unverified:0,skipped:0};
  };
  const loadBatch=async()=>({cards:entries,sourceCommit:sourceTag});
  const svc=createShrimpReleaseService({loadBatch,publish});
  return {svc,store,writes,jobs,attempts};
}
const guild={id:'guild-123'};

test('exact pinned Aquapedia source produces 22 unapproved review records offline',async()=>{
 const x=await loadPinnedShrimpRelease();
 assert.equal(x.cards.length,22);
 assert.equal(x.cards.filter(c=>c.entityType==='breeder').length,14);
 assert.equal(x.cards.filter(c=>c.entityType==='competition').length,8);
 assert.equal(x.sourceCommit,'2bade20e5a0e80b1c6786c0be6523a2cef92dda7');
 assert.equal(x.approval,'CLOSED');
});

test('status performs no writes; remaining batch is denied before saved canary',async()=>{
 const h=harness();
 const status=await h.svc.run({mode:'status',guild,store:h.store});
 assert.equal(status.stage,'not_started');
 const rest=await h.svc.run({mode:'finish',guild,store:h.store,ownerApproved:true});
 assert.equal(rest.stage,'blocked_canary_required');
 assert.equal(h.writes.length,0);
 assert.equal(h.attempts.length,0);
});

test('owner-triggered canary receipt must be saved before finishing remaining 21 records',async()=>{
 const h=harness();
 const canary=await h.svc.run({mode:'canary',guild,store:h.store,ownerApproved:true});
 assert.equal(canary.stage,'canary_verified');
 assert.equal(h.attempts[0].cards.length,1);
 assert.equal(h.attempts[0].publicAudienceApproved,true);
 assert.equal(h.writes.length,1);
 assert.equal(h.writes[0].discordPublicationReceipts[0].recordId,entries[0].id);
 const rest=await h.svc.run({mode:'finish',guild,store:h.store,ownerApproved:true});
 assert.equal(rest.stage,'completed');
 assert.equal(rest.verifiedCount,22);
 assert.equal(h.attempts[1].cards.length,21);
 assert.equal(h.jobs.size,1);
 const job=[...h.jobs.values()][0];
 assert.equal(job.discordPublicationReceipts.length,22);
 const again=await h.svc.run({mode:'finish',guild,store:h.store,ownerApproved:true});
 assert.equal(again.stage,'completed');
 assert.equal(h.attempts.length,2,'no extra Discord writes on completed batch');
});

test('mismatched guild cannot reuse the canary from another guild',async()=>{
 const h=harness();
 await h.svc.run({mode:'canary',guild,store:h.store,ownerApproved:true});
 const x=await h.svc.run({mode:'finish',guild:{id:'other-guild'},store:h.store,ownerApproved:true});
 assert.equal(x.stage,'blocked_canary_required');
 assert.equal(h.attempts.length,1);
});

test('unverified Discord response is not recorded as completed',async()=>{
 const h=harness({unverified:true});
 const x=await h.svc.run({mode:'canary',guild,store:h.store,ownerApproved:true});
 assert.equal(x.stage,'canary_unverified');
 assert.equal(h.writes.length,0);
});

test('failed durable receipt write does not falsely claim canary success',async()=>{
 const h=harness({failWrite:true});
 await assert.rejects(()=>h.svc.run({mode:'canary',guild,store:h.store,ownerApproved:true}),/Persistent state unavailable/);
 assert.equal(h.writes.length,0);
});

test('unknown mode is rejected without publication',async()=>{
 const h=harness();
 await assert.rejects(()=>h.svc.run({mode:'surprise',guild,store:h.store}),/Unknown shrimp release command/);
 assert.equal(h.attempts.length,0);
});

test('canary and finish fail closed without authenticated owner approval',async()=>{
 const h=harness();
 const canary=await h.svc.run({mode:'canary',guild,store:h.store});
 const finish=await h.svc.run({mode:'finish',guild,store:h.store});
 assert.equal(canary.stage,'owner_approval_required');
 assert.equal(finish.stage,'owner_approval_required');
 assert.equal(h.attempts.length,0);
 assert.equal(h.writes.length,0);
});

test('a modified pinned breeder snapshot is rejected before any publication',async()=>{
 await assert.rejects(()=>loadPinnedShrimpRelease({
  readSource:async(fileName)=>fileName==='breeders.json'?'{"cards":[]}':'{"records":[]}',
 }),/checksum mismatch/);
});

test('partial remainder publication never claims full release',async()=>{
 const h=harness();
 await h.svc.run({mode:'canary',guild,store:h.store,ownerApproved:true});
 const svc=createShrimpReleaseService({
  loadBatch:async()=>({cards:entries,sourceCommit:sourceTag}),
  publish:async()=>({
   posted:1,
   receipts:[{recordId:entries[1].id,threadId:'thread-1',messageId:'msg-1',verified:true}],
   unverified:1,skipped:19,
  }),
 });
 const rest=await svc.run({mode:'finish',guild,store:h.store,ownerApproved:true});
 assert.equal(rest.stage,'partial');
 assert.equal(rest.verifiedCount,2);
 assert.equal(h.jobs.size,1);
 assert.equal([...h.jobs.values()][0].discordPublicationReceipts.length,2);
});

test('Discord command exposes explicit status/canary/finish to administrators only',()=>{
 const route=createCommandRouter({config:{discord:{ownerUserId:'guild-owner'}}});
 const cmd=route.definitions.find(x=>x.name==='shrimp-release');
 assert.ok(cmd);
 assert.equal(cmd.default_member_permissions,String(8));
 assert.deepEqual(cmd.options.map(x=>x.name),['status','canary','finish']);
});

test('persistent Aquaphoria store reopens actual verified canary receipts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aqua-shrimp-release-'));
 try {
   const s=createStore({dataDir:dir});
   assert.equal(await s.getResearchJob('no-release'),null);
   await s.recordResearchJob({id:'release-test',guildId:'guild-123',releaseStage:'canary_verified',
      discordPublicationReceipts:[{recordId:'breeder-1',threadId:'123',messageId:'456',verified:true}]});
   const reloaded=createStore({dataDir:dir});
   assert.equal((await reloaded.getResearchJob('release-test')).discordPublicationReceipts[0].messageId,'456');
 } finally { await rm(dir,{recursive:true,force:true}); }
});
