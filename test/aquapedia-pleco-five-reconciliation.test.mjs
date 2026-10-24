import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileFivePlecoSourcePosts} from '../src/aquapedia-pleco-five-reconciliation.mjs';
const file=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const catalog=file('./fixtures/plecopedia-public-source-20261021.json');
const receipts=file('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const queue=file('../resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
const manifest=file('../resources/aquapedia-cross-taxa-release-review-20261021.json');
test('five exact public source-only posts reduce historic unapproved 91 to 86, leaving archived untouched',()=>{
 const r=reconcileFivePlecoSourcePosts(catalog,receipts,queue,manifest);
 assert.equal(r.verifiedPlecoSourceOnlyMessages,5);
 assert.equal(r.remainingProposals,86);
 assert.equal(r.remainingActive,50);
 assert.equal(r.remainingArchived,36);
 assert.deepEqual(r.remainingByGroup,{pleco:80,corydoras:6});
 assert.equal(r.remainingPublicationAuthorized,false);
 assert.equal(r.discordWritesInReconciliation,0);
});
test('cannot count edited bot receipt, changed source, or wrong thread as released',()=>{
 for(const override of [
   {...receipts,verified:false},
   {...receipts,records:receipts.records.map((r,i)=>i===0?{...r,contentSha256:'0'.repeat(64)}:r)},
   {...receipts,records:receipts.records.map((r,i)=>i===1?{...r,threadId:'999999999999999999'}:r)},
   {...receipts,records:receipts.records.map((r,i)=>i===3?{...r,key:'anc-leoni'}:r)}
 ])assert.throws(()=>reconcileFivePlecoSourcePosts(catalog,override,queue,manifest),/Pleco five receipts/);
 assert.throws(()=>reconcileFivePlecoSourcePosts(catalog,receipts,queue,{...manifest,publicationAuthorized:true}),/Pleco five receipts/);
});
