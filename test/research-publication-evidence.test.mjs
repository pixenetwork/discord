import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';
import { reconcileExternalPublication } from '../src/research-publication-evidence.mjs';
import { createCommandRouter } from '../src/commands.mjs';

const jobId='d4eae707-c166-49fb-9b4b-9397a9962355';
const receipt={
  guild:'1519337502379475095',forum:'1561189286399705128',
  threadId:'1562401901713297490',messageId:'1562401901713297490',
  botId:'1535522109571203152',
  url:'https://aquapedia.app/medakapedia/strains/yoru/',
  verifiedAt:'2026-10-21T09:47:21.734Z',
};
const params={guildId:receipt.guild,medakaForumId:receipt.forum,discordToken:'unit-test-token'};
function stubFetch({authorId=receipt.botId,parentId=receipt.forum,siteHtml=null}={}) {
  const calls=[];
  const body=siteHtml??'<html><title>Yoru (夜) | Aquapedia</title><div data-medaka-picture-tree="1">Yoru (夜) Parent lines not documented Mimu Medaka</div></html>';
  const fetchImpl=async (input,init={})=>{
    const url=String(input);
    calls.push({url,method:init.method??'GET'});
    assert.equal(init.method??'GET','GET');
    if(url===receipt.url)return new Response(body,{status:200,headers:{'content-type':'text/html'}});
    if(url.endsWith('/users/@me'))return Response.json({id:receipt.botId});
    if(url.endsWith('/channels/'+receipt.threadId))return Response.json({
      id:receipt.threadId,parent_id:parentId,guild_id:receipt.guild,type:11,
    });
    if(url.endsWith('/channels/'+receipt.threadId+'/messages/'+receipt.messageId))return Response.json({
      id:receipt.messageId,channel_id:receipt.threadId,author:{id:authorId},
      timestamp:'2026-10-21T09:47:21.000Z',
      content:'Yoru 2026 Mimu Medaka; TOA is NOT necessarily the original creator; Parent lines not documented. Yoru Kuro. '+receipt.url,
    });
    throw new Error('Unexpected request: '+url);
  };
  return {fetchImpl,calls};
}
async function fixture(fn) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'aquapedia-publication-proof-'));
  try {
    const store=createStore({dataDir:dir});
    await store.recordResearchJob({
      id:jobId,entityType:'strain',name:'yoru',status:'queued',
      requestedBy:'hidden-requester-id',createdAt:'2026-10-21T09:03:48.428Z',
    });
    return await fn(store,dir);
  }finally{await rm(dir,{recursive:true,force:true})}
}
test('authenticated Yoru website+Discord evidence links to queue without mutating original research state',async()=>{
  await fixture(async(store,dir)=>{
    const {fetchImpl,calls}=stubFetch();
    const res=await reconcileExternalPublication({store,jobId,receipt,...params,fetchImpl});
    assert.equal(res.evidenceStatus,'published_creator_pending');
    assert.equal(res.siteUrl,receipt.url);
    assert.equal(calls.length,4);
    assert.equal((await store.getResearchJob(jobId)).status,'queued');
    const saved=JSON.parse(await readFile(path.join(dir,'research-publication-evidence',jobId+'.json'),'utf8'));
    assert.equal(saved.discordThreadId,receipt.threadId);
    assert.equal(saved.siteUrl,receipt.url);
    assert.equal(saved.evidenceStatus,'published_creator_pending');
    assert.equal(JSON.stringify(saved).includes('hidden-requester-id'),false);
    assert.equal(JSON.stringify(saved).includes(params.discordToken),false);
    const report=await store.listResearchJobs();
    assert.equal(report.counts.queued,1);
    assert.equal(report.jobs[0].publicationEvidence.evidenceStatus,'published_creator_pending');
    assert.equal(report.jobs[0].publicationEvidence.siteUrl,receipt.url);
    const repeated=await reconcileExternalPublication({store,jobId,receipt,...params,fetchImpl});
    assert.deepEqual(repeated,res);
  });
});
test('unverified bot authorship refuses publication evidence; queued state remains unchanged',async()=>{
  await fixture(async(store)=>{
    const {fetchImpl}=stubFetch({authorId:'999999999999999999'});
    await assert.rejects(reconcileExternalPublication({store,jobId,receipt,...params,fetchImpl}),/author|bot/i);
    assert.equal((await store.listResearchJobs()).jobs[0].publicationEvidence,undefined);
    assert.equal((await store.getResearchJob(jobId)).status,'queued');
  });
});
test('mismatched forum or unrelated Reris topic cannot be reconciled as Yoru',async()=>{
  await fixture(async(store)=>{
    const {fetchImpl}=stubFetch({parentId:'111111111111111111'});
    await assert.rejects(reconcileExternalPublication({store,jobId,receipt,...params,fetchImpl}),/forum|parent/i);
    await store.recordResearchJob({id:'7c8ba279-93dd-4f47-a9ee-013e08f90fc6',entityType:'strain',name:'reris',status:'started',requestedBy:'private'});
    await assert.rejects(reconcileExternalPublication({store,jobId:'7c8ba279-93dd-4f47-a9ee-013e08f90fc6',receipt,...params,fetchImpl}),/queued|topic|slug/i);
  });
});
test('owner-only queue clearly labels cited publication as provisional without claiming Jarvis completed',async()=>{
  let reply;
  const router=createCommandRouter({
    config:{discord:{ownerUserId:'owner-id'}},
    store:{async listResearchJobs(){return {total:1,counts:{queued:1},distinctTopics:1,repeatRequests:0,jobs:[{
      id:jobId,name:'yoru',status:'queued',createdAt:'2026-10-21T09:03:48.428Z',
      publicationEvidence:{evidenceStatus:'published_creator_pending',siteUrl:receipt.url},
    }]}}},
  });
  await router.handle({user:{id:'owner-id'},commandName:'research-queue',isChatInputCommand:()=>true,
    async deferReply(){},async editReply(s){reply=s;}});
  assert.match(reply,/published/i);
  assert.match(reply,/creator|origin/i);
  assert.match(reply,/queued/i);
  assert.match(reply,/aquapedia\.app\/medakapedia\/strains\/yoru/);
  assert.doesNotMatch(reply,/completed/i);
});
