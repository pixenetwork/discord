import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditCrossTaxaLiveTargets} from '../src/aquapedia-cross-taxa-live-preflight.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../resources/aquapedia-cross-taxa-release-review-20261021.json',import.meta.url),'utf8'));
const bot='133700000000000001';
const forums={guppy:'1562195139353645146',pleco:'1560931428680601630',corydoras:'1560887812910350339'};
const firstById=new Map();
for(const x of manifest.proposals)if(!firstById.has(x.existingThreadId))firstById.set(x.existingThreadId,x);
const base={
 botUserId:bot,observedAt:'2026-10-22T03:00:00.000Z',
 readThread:async id=>({id,parentId:forums[firstById.get(id).group],archived:firstById.get(id).archived,locked:false}),
 readMessages:async id=>[{id,authorId:bot,content:'Original documented research with external citations https://doi.org/10.1000/example'}]
};
test('preflight audits 97 distinct bot-owned targets for 99 proposals without publishing',async()=>{
 const result=await auditCrossTaxaLiveTargets(manifest,base);
 assert.equal(result.distinctThreadCount,97);
 assert.equal(result.proposalCount,99);
 assert.equal(result.ownerVerified,97);
 assert.equal(result.completeReadWindow,97);
 assert.equal(result.alreadyLinked,0);
 assert.equal(result.partialLinked,0);
 assert.equal(result.missingLinks,99);
 assert.equal(result.archivedProposals,36);
 assert.equal(result.archiveDrift,0);
 assert.equal(result.lockedThreads,0);
 assert.equal(result.publicationAuthorized,false);
 assert.equal(result.discordWrites,0);
 assert.deepEqual(result.byGroup,{guppy:{total:4,linked:0,partial:0,missing:4},corydoras:{total:10,linked:0,partial:0,missing:10},pleco:{total:85,linked:0,partial:0,missing:85}});
});
test('preflight detects externally posted link and removes it from missing tally without sending anything',async()=>{
 const example=manifest.proposals.find(x=>x.group==='pleco');
 const opts={...base,readMessages:async id=>[{id,authorId:bot,content:id===example.existingThreadId?'New direct link '+example.sourceUrls[0]:'Original research'}]};
 const p=await auditCrossTaxaLiveTargets(manifest,opts);
 assert.equal(p.alreadyLinked,1);
 assert.equal(p.missingLinks,98);
 assert.equal(p.discordWrites,0);
});
test('preflight records archive drift, locked threads and incomplete message windows as blockers',async()=>{
 const id=manifest.proposals.find(x=>x.group==='pleco').existingThreadId;
 const o={...base,
  readThread:async t=>({...await base.readThread(t),archived:t===id?!firstById.get(t).archived:firstById.get(t).archived,locked:t===id}),
  readMessages:async t=>t===id?Array.from({length:25},(_,i)=>({id:i===0?t:String(i+1),authorId:bot,content:'Older research'})):base.readMessages(t)
 };
 const p=await auditCrossTaxaLiveTargets(manifest,o);
 assert.equal(p.archiveDrift,1);
 assert.equal(p.lockedThreads,1);
 assert.equal(p.completeReadWindow,96);
 assert.equal(p.publicationAuthorized,false);
});
test('preflight fails closed on malformed targets, missing bot authorship or unsafe manifest state',async()=>{
 await assert.rejects(auditCrossTaxaLiveTargets({...manifest,publicationAuthorized:true},base),/Live preflight/);
 await assert.rejects(auditCrossTaxaLiveTargets(manifest,{...base,readMessages:async id=>[{id,authorId:'other',content:'research'}]}),/Live preflight/);
 await assert.rejects(auditCrossTaxaLiveTargets(manifest,{...base,readThread:async t=>({...await base.readThread(t),parentId:'111'})}),/Live preflight/);
 await assert.rejects(auditCrossTaxaLiveTargets(manifest,{...base,observedAt:'invalid'}),/Live preflight/);
});
