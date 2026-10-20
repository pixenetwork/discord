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
function fixture({
  grant=true,complete=true,threads=[],alterReadback=false,previousReceipt=false,
}={}){
  const calls={created:0,sent:0,stored:0,locks:0,unlocks:0};
  const botId='995';
  const records=new Map();
  let id=8000;
  const discord={
    botId,
    async getForumState(){return {
      guildId:plan.guildId,forumId:plan.forumId,
      publicView:true,readMessageHistory:true,botMayPost:true,
    };},
    async enumerateThreads(){return {complete,threads};},
    async createThread(params){
      calls.created++;
      assert.equal(params.forumId,plan.forumId);
      assert.deepEqual(params.allowedMentions,{parse:[]});
      assert.equal(params.flags,4096,"source citations must not generate third-party fish photo previews");
      const starterId=String(++id);
      records.set(starterId,{id:starterId,author:{id:botId},content:params.content});
      return {threadId:'6000',starterId};
    },
    async send(threadId,params){
      calls.sent++;
      assert.equal(threadId,'6000');
      assert.deepEqual(params.allowedMentions,{parse:[]});
      assert.equal(params.flags,4096,"source citations must not generate third-party fish photo previews");
      const messageId=String(++id);
      records.set(messageId,{id:messageId,author:{id:botId},content:params.content});
      return {id:messageId};
    },
    async fetchMessage(_thread,id){
      const value=records.get(id);
      if(!value)return null;
      return alterReadback&&id==='8002'?{...value,content:'altered '+value.content}:value;
    },
  };
  const receiptStore={
    async get(){return previousReceipt?{jobId:plan.jobId,sourceSha256:plan.sourceSha256}:null;},
    async save(receipt){calls.stored++;assert.equal(receipt.messageIds.length,11);}
  };
  const lock={
    async acquire(){calls.locks++;return async()=>{calls.unlocks++;};}
  };
  const authorizer={
    async verifySignedApproval(job){
      return grant?{verified:true,jobId:plan.jobId,sourceSha256:plan.sourceSha256,
        guildId:plan.guildId,forumId:plan.forumId,
        discordPublicationApproved:true,publicAudienceApproved:true}: {verified:false};
    },
  };
  return {calls,discord,receiptStore,lock,authorizer};
}
const request=(fix,opts={})=>publishApprovedMedaka79({
  plan,job:{id:'owner-request-20261020'},...fix,...opts
});

test('denies before any write without validated publisher authorization',async()=>{
  const fix=fixture({grant:false});
  await assert.rejects(request(fix),/signed publication authorization/i);
  assert.equal(fix.calls.created,0);
  assert.equal(fix.calls.stored,0);
  assert.equal(fix.calls.locks,0);
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
  changed.parts[0].content+='\nUnreviewed extra claim';
  await assert.rejects(request(f,{plan:changed}),/source-locked message content/i);
  assert.equal(f.calls.created,0);
  assert.equal(f.calls.stored,0);
});

test('preexisting receipt blocks all new writes until separately verified',async()=>{
  const fix=fixture({previousReceipt:true});
  await assert.rejects(request(fix),/already exists/i);
  assert.equal(fix.calls.created,0);
  assert.equal(fix.calls.stored,0);
});
