import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageCrossTaxaActiveBatch} from '../src/aquapedia-cross-taxa-active-staging.mjs';
const source=JSON.parse(fs.readFileSync(new URL('../resources/aquapedia-cross-taxa-release-review-20261021.json',import.meta.url),'utf8'));
test('stage exactly 63 active proposals, excluding 36 archived without reopening anything',()=>{
 const staged=stageCrossTaxaActiveBatch(source);
 assert.equal(staged.activeProposalCount,63);
 assert.equal(staged.archivedHeld,36);
 assert.equal(staged.publicationAuthorized,false);
 assert.equal(staged.discordWrites,0);
 assert.equal(staged.newThreadsToCreate,0);
 assert.deepEqual(staged.byGroup,{guppy:4,corydoras:4,pleco:55});
 assert.equal(staged.batches.length,6);
 assert.deepEqual(staged.batches.map(b=>b.items.length),[12,12,12,12,12,3]);
 assert.ok(staged.batches.flatMap(x=>x.items).every(x=>!x.archived&&x.approval==='not-granted'));
 assert.equal(new Set(staged.batches.flatMap(x=>x.items.map(p=>p.receiptKey))).size,63);
 assert.ok(staged.batches[0].items.some(x=>x.group==='guppy'));
 assert.ok(staged.batches.every(x=>x.canPublish===false));
});
test('archived targets are held with original source and thread IDs for a separate reviewed pass',()=>{
 const staged=stageCrossTaxaActiveBatch(source);
 assert.equal(staged.archived.length,36);
 assert.ok(staged.archived.every(x=>x.archived && x.existingThreadId && x.sourceUrls.length));
 assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(staged.archived,x=>x.group)).map(([k,v])=>[k,v.length])),{corydoras:6,pleco:30});
});
test('changing supplied approval flags does not authorize publication or change batch size cap',()=>{
 const staged=stageCrossTaxaActiveBatch(source,{approved:true,limit:500,force:true});
 assert.equal(staged.publicationAuthorized,false);
 assert.deepEqual(staged.batches.map(b=>b.items.length),[12,12,12,12,12,3]);
});
test('untrusted or mutated manifests fail closed instead of releasing duplicates',()=>{
 assert.throws(()=>stageCrossTaxaActiveBatch({...source,publicationAuthorized:true}),/Active staging/);
 assert.throws(()=>stageCrossTaxaActiveBatch({...source,proposals:source.proposals.slice(1)}),/Active staging/);
 assert.throws(()=>stageCrossTaxaActiveBatch({...source,proposals:[...source.proposals.slice(0,-1),source.proposals[0]]}),/Active staging/);
 assert.throws(()=>stageCrossTaxaActiveBatch({...source,proposals:source.proposals.map((x,i)=>i===0?{...x,archived:true}:x)}),/Active staging/);
});
