import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildMedaka79Index} from '../src/medaka79-research-index.mjs';
import {publishApprovedMedaka79} from '../src/medaka79-approved-publisher.mjs';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bytes=readFileSync(path.join(dir,'resources/aquapedia-medaka79-20261020.json'));
const plan=buildMedaka79Index(JSON.parse(bytes),{rawSource:bytes});

// ---------------------------------------------------------------------------
// Shared fixture factory
// partial: pre-seeded partial state (simulates a prior interrupted run)
// nullFetch: if true, fetchMessage returns null for the first reply ID
// ---------------------------------------------------------------------------
function fixture({
  grant=true,complete=true,threads=null,alterReadback=false,
  previousReceipt=false,partial=null,nullFetch=false,extraUncheckpointedReply=false,
}={}){
  const calls={created:0,sent:0,stored:0,locks:0,unlocks:0,partialSaves:0};
  const botId='995';
  const records=new Map();
  let id=8000;
  // If resuming from partial, pre-populate records for already-sent messages.
  if(partial?.messageIds){
    const allContent=[plan.starter,...plan.parts.map(p=>p.content)];
    partial.messageIds.forEach((mid,i)=>{
      records.set(String(mid),{id:String(mid),author:{id:botId},content:allContent[i]});
    });
  }
  if(extraUncheckpointedReply){
    records.set('7100',{id:'7100',author:{id:botId},content:plan.parts[2].content});
  }
  const discord={
    botId,
    async getForumState(){return {
      guildId:plan.guildId,forumId:plan.forumId,
      publicView:true,readMessageHistory:true,botMayPost:true,
    };},
    async enumerateThreads(){return {complete,threads:threads??(partial?[{id:String(partial.threadId),name:plan.threadName}]:[])};},
    async enumerateThreadMessages(){return {complete:true,messages:Array.from(records.values())};},
    async createThread(params){
      calls.created++;
      assert.equal(params.forumId,plan.forumId);
      assert.deepEqual(params.allowedMentions,{parse:[]});
      assert.equal(params.flags,4096,'source citations must not generate third-party fish photo previews');
      const starterId=String(++id);
      records.set(starterId,{id:starterId,author:{id:botId},content:params.content});
      return {threadId:'6000',starterId};
    },
    async send(threadId,params){
      calls.sent++;
      assert.deepEqual(params.allowedMentions,{parse:[]});
      assert.equal(params.flags,4096,'source citations must not generate third-party fish photo previews');
      const messageId=String(++id);
      records.set(messageId,{id:messageId,author:{id:botId},content:params.content});
      return {id:messageId};
    },
    async fetchMessage(_thread,mid){
      if(nullFetch&&mid===String(partial?.messageIds?.[1]??'8002'))return null;
      const value=records.get(mid);
      if(!value)return null;
      return alterReadback&&mid==='8002'?{...value,content:'altered '+value.content}:value;
    },
  };
  let storedPartial=partial?{...partial}:null;
  const receiptStore={
    async get(){return previousReceipt?{jobId:plan.jobId,sourceSha256:plan.sourceSha256}:null;},
    async save(receipt){calls.stored++;assert.equal(receipt.messageIds.length,11);},
    async savePartial(p){calls.partialSaves++;storedPartial={...p};},
    async loadPartial(){return storedPartial;},
  };
  const lock={
    async acquire(){calls.locks++;return async()=>{calls.unlocks++;};}
  };
  const authorizer={
    async verifySignedApproval(){
      return grant?{verified:true,jobId:plan.jobId,sourceSha256:plan.sourceSha256,
        guildId:plan.guildId,forumId:plan.forumId,
        discordPublicationApproved:true,publicAudienceApproved:true}:{verified:false};
    },
  };
  return {calls,discord,receiptStore,lock,authorizer,storedPartialRef:()=>storedPartial};
}
const request=(fix,opts={})=>publishApprovedMedaka79({
  plan,job:{id:'owner-request-20261020'},...fix,...opts
});

// ---------------------------------------------------------------------------
// Issue 2 red test: misconfigured runtime (missing savePartial) must fail
// BEFORE consuming the signed grant (lock count must remain 0).
// ---------------------------------------------------------------------------
test('RED issue-2: misconfigured runtime is rejected before consuming signed grant',async()=>{
  const fix=fixture();
  // Remove savePartial so the capability guard fires before verifySignedApproval.
  delete fix.receiptStore.savePartial;
  await assert.rejects(request(fix),/runtime unavailable/i);
  assert.equal(fix.calls.locks,0,'lock must not be acquired when runtime is misconfigured');
});

// Issue 6 — assert unlock count zero on authorization denial
test('denies before any write without validated publisher authorization',async()=>{
  const fix=fixture({grant:false});
  await assert.rejects(request(fix),/signed publication authorization/i);
  assert.equal(fix.calls.created,0);
  assert.equal(fix.calls.stored,0);
  assert.equal(fix.calls.locks,0);
  // Issue 6 fix: lock must never be acquired, so unlock count must also be zero.
  assert.equal(fix.calls.unlocks,0,'lock was never acquired so release must never be called');
});

test('creates exactly 11 approved messages and stores receipt only after full readback',async()=>{
  const fix=fixture();
  const receipt=await request(fix);
  assert.equal(fix.calls.created,1);
  assert.equal(fix.calls.sent,10);
  assert.equal(fix.calls.stored,1);
  assert.equal(fix.calls.locks,1);
  assert.equal(fix.calls.unlocks,1);
  assert.equal(receipt.entries,79);
  assert.equal(receipt.sourceSha256,plan.sourceSha256);
  assert.equal(receipt.messageIds.length,11);
  assert.equal(receipt.threadUrl,'https://discord.com/channels/'+plan.guildId+'/6000/8001');
  // Issue 1: partial state must have been saved (thread + all 10 replies = 11 saves).
  assert.equal(fix.calls.partialSaves,11,'partial state must be checkpointed after thread creation and each reply');
});

// ---------------------------------------------------------------------------
// Issue 1 red test: with no partial-state support the resume path is absent;
// verify that once partial is seeded the run skips createThread entirely.
// ---------------------------------------------------------------------------
test('RED issue-1: interrupted run without partial state would create duplicate thread',async()=>{
  // Simulate an existing Discord thread that would block a blind retry.
  const fix=fixture({threads:[{id:'prior-partial',name:plan.threadName}]});
  await assert.rejects(request(fix),/duplicate/i);
  assert.equal(fix.calls.created,0);
});

test('resumes partial publication without creating a duplicate thread',async()=>{
  // Simulate 3 messages already sent in a prior interrupted run.
  const priorIds=['7001','7002','7003'];
  const fix=fixture({partial:{jobId:plan.jobId,threadId:'6000',messageIds:priorIds}});
  const receipt=await request(fix);
  // createThread must NOT be called — we resume into the existing thread.
  assert.equal(fix.calls.created,0,'must not create a duplicate thread when resuming');
  // Only the 8 remaining replies should be sent.
  assert.equal(fix.calls.sent,8,'must send only the remaining replies');
  assert.equal(receipt.messageIds.length,11);
  assert.equal(fix.calls.stored,1);
  // Issue 1: partial state must be updated for each of the 8 resumed replies.
  assert.equal(fix.calls.partialSaves,8,'partial state must be checkpointed for each resumed reply');
});

// ---------------------------------------------------------------------------
// Issue 3 red test: null fetchMessage returns must surface as a named error.
// ---------------------------------------------------------------------------
test('RED issue-3: null fetchMessage silently passes into verifyMedaka79PublishedMessages',async()=>{
  // This test documents the pre-fix behaviour: without the explicit null guard
  // the error message would be the generic readback-mismatch, not a fetch error.
  // After the fix, the error is the specific fetch-failure message.
  const priorIds=['7001','7002','7003'];
  const fix=fixture({
    partial:{jobId:plan.jobId,threadId:'6000',messageIds:priorIds},
    nullFetch:true,
  });
  await assert.rejects(
    request(fix),
    /could not be fetched after posting/i,
    'null fetch must surface as a specific diagnostic, not a generic readback mismatch',
  );
  assert.equal(fix.calls.stored,0);
});

test('blocks incomplete archive enumeration and known duplicate before posting',async()=>{
  for(const f of [fixture({complete:false}),fixture({threads:[{id:'prior',name:plan.threadName}]})]){
    await assert.rejects(request(f),/thread history|duplicate/i);
    assert.equal(f.calls.created,0);
    assert.equal(f.calls.stored,0);
    assert.equal(f.calls.unlocks,1);
  }
});

test('tampered Discord readback never becomes a completion receipt',async()=>{
  const fix=fixture({alterReadback:true});
  await assert.rejects(request(fix),/readback mismatch/i);
  assert.equal(fix.calls.stored,0);
  assert.equal(fix.calls.unlocks,1);
});

test('signed source hash cannot authorize changed Discord message content',async()=>{
  const f=fixture();
  const changed=structuredClone(plan);
  changed.parts[0].content+=' altered source-locked claim';
  await assert.rejects(request(f,{plan:changed}),/source-locked message content/i);
  assert.equal(f.calls.created,0);
  assert.equal(f.calls.stored,0);
});

test('partial restart refuses wrong publication identity before sending replies',async()=>{
  const fix=fixture({partial:{jobId:'other-publication',threadId:'6000',messageIds:['7001']}});
  await assert.rejects(request(fix),/partial|resume|publication/i);
  assert.equal(fix.calls.sent,0,'wrong saved job must never authorize writes');
  assert.equal(fix.calls.created,0);
  assert.equal(fix.calls.stored,0);
});

test('partial restart verifies existing Discord messages before sending more',async()=>{
  const fix=fixture({partial:{jobId:plan.jobId,threadId:'6000',messageIds:['7001','7002','7003']}});
  const original=fix.discord.fetchMessage;
  fix.discord.fetchMessage=async (...args)=>{
    const msg=await original(...args);
    return msg?.id==='7002'?{...msg,content:'tampered old reply'}:msg;
  };
  await assert.rejects(request(fix),/partial|resume|readback|mismatch/i);
  assert.equal(fix.calls.sent,0,'do not post new replies before validating the checkpointed ones');
  assert.equal(fix.calls.stored,0);
});

test('interrupted reply without checkpoint blocks retry instead of duplicating message',async()=>{
  const fix=fixture({
    partial:{jobId:plan.jobId,threadId:'6000',messageIds:['7001','7002','7003']},
    extraUncheckpointedReply:true,
  });
  await assert.rejects(request(fix),/uncheckpointed|reconciliation|thread message/i);
  assert.equal(fix.calls.sent,0,'uncheckpointed Discord reply must not be sent twice');
  assert.equal(fix.calls.stored,0);
});

test('preexisting receipt blocks all new writes until separately verified',async()=>{
  const fix=fixture({previousReceipt:true});
  await assert.rejects(request(fix),/already exists/i);
  assert.equal(fix.calls.created,0);
  assert.equal(fix.calls.stored,0);
});
