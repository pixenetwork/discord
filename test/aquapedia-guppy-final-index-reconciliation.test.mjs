import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileAllGuppyShowIndexes} from '../src/aquapedia-guppy-final-index-reconciliation.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=read('./fixtures/guppypedia-source-20261021.json');
const base=read('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const others=read('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const manifest=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
test('48 show-standard entries indexed with four verified receipts, 95 other proposals remain held',()=>{
 const r=reconcileAllGuppyShowIndexes(catalog,base,others,manifest);
 assert.equal(r.verifiedGuppyIndexMessages,4);
 assert.equal(r.verifiedGuppySourceUrls,48);
 assert.deepEqual(r.completedNewMessageReceipts.map(x=>x.sourceCount),[19,6,13]);
 assert.deepEqual(r.pendingByGroup,{corydoras:10,pleco:85});
 assert.equal(r.pendingCrossTaxaProposals,95);
 assert.equal(r.pendingActive,59);
 assert.equal(r.pendingArchived,36);
 assert.equal(r.heldGuppyCommercialAndHybridLabels,128);
 assert.equal(r.remainingPublicationsAuthorized,false);
});
test('tampered source order, message, hash, or user approval flag is rejected',()=>{
 assert.throws(()=>reconcileAllGuppyShowIndexes(catalog.slice(1),base,others,manifest),/Guppy final source-index reconciliation/);
 assert.throws(()=>reconcileAllGuppyShowIndexes(catalog,{...base,verified:false},others,manifest),/Guppy final source-index reconciliation/);
 assert.throws(()=>reconcileAllGuppyShowIndexes(catalog,base,{...others,topics:[...others.topics].reverse()},manifest),/Guppy final source-index reconciliation/);
 assert.throws(()=>reconcileAllGuppyShowIndexes(catalog,base,{...others,topics:others.topics.map((p,i)=>i===1?{...p,messageSha256:'0'.repeat(64)}:p)},manifest),/Guppy final source-index reconciliation/);
 assert.throws(()=>reconcileAllGuppyShowIndexes(catalog,base,others,{...manifest,publicationAuthorized:true}),/Guppy final source-index reconciliation/);
});
