import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createResearchService } from '../src/research.mjs';
import { createStore } from '../src/store.mjs';
import { createCommandRouter } from '../src/commands.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aquapedia-recovery-'));
  try { return await run(createStore({ dataDir: dir })); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
const who = '1519337502379475095';
const jobArgs = { entityType: 'strain', name: 'Mega Rayquaza', requestedBy: who };
const aquapedia = { repository: 'pixenetwork/aquapedia', branch: 'main', githubToken: null };

test('failed Jarvis handoff records needs_review durably rather than trapping an untracked started job', async () => {
  await fixture(async (store) => {
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline authentication detail MUST_NOT_PERSIST'); };
    try {
      const service = createResearchService({
        store, aquapedia, jarvis: { researchEndpoint: 'https://example.net/research', apiKey: null },
      });
      await assert.rejects(() => service.research(jobArgs), /offline authentication/);
      const report = await store.listResearchJobs();
      assert.equal(report.total, 1);
      assert.equal(report.counts.needs_review, 1);
      const saved = await store.getResearchJob(report.jobs[0].id);
      assert.equal(saved.status, 'needs_review');
      assert.equal(saved.failureStage, 'jarvis_handoff');
      assert.equal(saved.discordPublicationApproved, undefined);
      assert.equal(JSON.stringify(saved).includes('MUST_NOT_PERSIST'), false);
    } finally { globalThis.fetch = fetchBefore; }
  });
});

test('failed Aquapedia write records needs_review after Jarvis result without granting publishing approval', async () => {
  await fixture(async (store) => {
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return {
        status: 'completed',
        discordPublicationApproved: true,
        files: [{ path: 'research/unsafe-to-autopublish.md', content: 'Needs review' }],
      }; },
    });
    try {
      const service = createResearchService({
        store, aquapedia, jarvis: { researchEndpoint: 'https://example.net/research', apiKey: null },
      });
      await assert.rejects(() => service.research(jobArgs), /AQUAPEDIA_GITHUB_TOKEN/);
      const report = await store.listResearchJobs();
      const saved = await store.getResearchJob(report.jobs[0].id);
      assert.equal(saved.status, 'needs_review');
      assert.equal(saved.failureStage, 'aquapedia_sync');
      assert.equal(saved.discordPublicationApproved, undefined);
    } finally { globalThis.fetch = fetchBefore; }
  });
});

test('local research list summarizes all unique normalized subjects and repeat requests without requester IDs', async () => {
  await fixture(async (store) => {
    const names = ['godzilla',' GODZILLA  ','neptune','Reris','mega rayquaza','Mega Rayquaza','mega  rayquaza','mega rayquaza'];
    for (let i=0; i<names.length; i++) {
      await store.recordResearchJob({
        id:'job-'+i, name:names[i], entityType:'strain', status:'started',
        requestedBy:'private-member-id', createdAt:new Date(1700000000000+i*1000).toISOString(),
      });
    }
    const report = await store.listResearchJobs({limit:2});
    assert.equal(report.total, 8);
    assert.equal(report.jobs.length,2);
    assert.equal(report.distinctTopics,4);
    assert.equal(report.repeatRequests,4);
    assert.deepEqual(report.topics.map(t=>t.count).sort((a,b)=>b-a),[4,2,1,1]);
    assert.equal(JSON.stringify(report).includes('private-member-id'),false);
  });
});

test('owner-only /research-queue shows deduplication statistics read-only', async () => {
  let output;
  const router = createCommandRouter({
    config:{discord:{ownerUserId:'owner'}},
    store:{async listResearchJobs(){return {
      total:8,counts:{started:8},distinctTopics:4,repeatRequests:4,
      jobs:[{id:'job-id-01',name:'Mega Rayquaza',status:'started',createdAt:'2026-10-12T08:00:00Z'}],
    };}},
  });
  await router.handle({
    user:{id:'owner'},commandName:'research-queue',isChatInputCommand:()=>true,
    async deferReply(){},async editReply(v){output=v;},
  });
  assert.match(output,/4 distinct/i);
  assert.match(output,/4 repeat/i);
  assert.match(output,/needs review/i);
});

test('Jarvis research POST uses an abort signal so hung handoffs cannot remain started indefinitely', async () => {
  await fixture(async (store) => {
    const fetchBefore = globalThis.fetch;
    let called = false;
    globalThis.fetch = async (_url, options) => {
      called = true;
      assert.equal(options.method, 'POST');
      assert.ok(options.signal instanceof AbortSignal, 'Expected bounded network request');
      return { ok:true, async json(){return {status:'queued',files:[]};} };
    };
    try {
      const service=createResearchService({
        store, aquapedia, jarvis:{researchEndpoint:'https://example.net/research',apiKey:null},
      });
      const result=await service.research(jobArgs);
      assert.equal(called,true);
      assert.equal(result.status,'queued');
      assert.equal((await store.getResearchJob(result.jobId)).status,'queued');
    } finally {globalThis.fetch=fetchBefore;}
  });
});

test('Aquapedia lookup and write both use abort signals so stalled GitHub requests become reviewable', async () => {
  await fixture(async (store) => {
    const originalFetch=globalThis.fetch;
    const calls=[];
    globalThis.fetch=async (url,options) => {
      calls.push({url:String(url),method:options?.method??'GET',signal:options?.signal});
      if(String(url)==='https://example.net/research') return {
        ok:true, async json(){return {status:'completed',files:[{path:'research/drafts/test.md',content:'reviewed input'}]};},
      };
      if(!options?.method) return {ok:false,status:404, async json(){return {};}};
      if(options?.method==='PUT') return {ok:true,async json(){return {content:{html_url:'https://github.com/pixenetwork/aquapedia/blob/main/research/drafts/test.md'}};}};
      throw new Error('Unexpected fake request');
    };
    try {
      const service=createResearchService({
        store,
        aquapedia:{...aquapedia,githubToken:'fake-token-for-unit-test'},
        jarvis:{researchEndpoint:'https://example.net/research',apiKey:null},
      });
      const result=await service.research(jobArgs);
      assert.equal(result.status,'completed');
      assert.equal(calls.length,3);
      for(const c of calls) assert.ok(c.signal instanceof AbortSignal, 'Missing timeout on '+c.method);
    } finally {globalThis.fetch=originalFetch;}
  });
});
