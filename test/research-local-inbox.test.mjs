import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';
import { createResearchService } from '../src/research.mjs';
import { createCommandRouter } from '../src/commands.mjs';

test('without Jarvis, /research queues durably in the local store and never attempts GitHub publication', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aquapedia-local-inbox-'));
  try {
    const store = createStore({ dataDir: dir });
    const service = createResearchService({
      jarvis: { researchEndpoint: '' },
      aquapedia: { githubToken: null, repository: 'pixenetwork/aquapedia', branch: 'main' },
      store,
    });
    const result = await service.research({
      entityType: 'strain', name: 'Red Mosaic Guppy', requestedBy: '1519337502379475095',
    });
    assert.equal(result.status, 'queued');
    assert.equal(result.url, null);
    assert.equal(result.path, null);
    assert.ok(result.jobId);
    const reloaded = createStore({ dataDir: dir });
    const persisted = await reloaded.getResearchJob(result.jobId);
    assert.equal(persisted.status, 'queued');
    assert.equal(persisted.name, 'Red Mosaic Guppy');
    assert.equal(persisted.id, result.jobId);
    assert.equal(persisted.discordPublicationApproved, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('owner-only queue listing returns bounded newest-first safe projections with counts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aquapedia-research-list-'));
  try {
    const store = createStore({ dataDir: dir });
    await store.recordResearchJob({id:'job-1', name:'Old Job', status:'started', requestedBy:'private-user', createdAt:'2026-10-01T00:00:00Z'});
    await store.recordResearchJob({id:'job-2', name:'New Job', status:'queued', requestedBy:'private-user', createdAt:'2026-10-20T12:00:00Z'});
    const report = await createStore({ dataDir: dir }).listResearchJobs({ limit: 1 });
    assert.equal(report.total,2);
    assert.equal(report.counts.started,1);
    assert.equal(report.counts.queued,1);
    assert.equal(report.jobs.length,1);
    assert.equal(report.jobs[0].id,'job-2');
    assert.equal(report.jobs[0].name,'New Job');
    assert.equal(Object.hasOwn(report.jobs[0],'requestedBy'),false);
    await assert.rejects(() => store.listResearchJobs({limit:0}),/limit/i);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});

test('/research-queue is owner-only, ephemeral and read-only with stale started label', async () => {
  const jobs=[{id:'4042a0a9-xxxx',name:'Unfinished Guppy',status:'started',createdAt:'2026-10-12T08:00:00Z',updatedAt:'2026-10-12T08:00:00Z'}];
  let calls=0;
  const router=createCommandRouter({
    config:{discord:{ownerUserId:'owner-id'}},
    store:{async listResearchJobs(){calls++;return {total:8,counts:{started:8},jobs};}},
  });
  assert.ok(router.definitions.some(d=>d.name==='research-queue'));
  let denied;
  await router.handle({
    user:{id:'not-owner'},commandName:'research-queue',isChatInputCommand:()=>true,
    reply: async value=>{denied=value;},
  });
  assert.equal(calls,0);
  assert.equal(denied.ephemeral,true);
  assert.match(denied.content,/owner/i);
  let deferred, output;
  await router.handle({
    user:{id:'owner-id'},commandName:'research-queue',isChatInputCommand:()=>true,
    deferReply:async value=>{deferred=value;},
    editReply:async value=>{output=value;},
  });
  assert.equal(calls,1);
  assert.equal(deferred.ephemeral,true);
  assert.match(output,/8/);
  assert.match(output,/4042a0a9/);
  assert.match(output,/stale|needs review/i);
});
