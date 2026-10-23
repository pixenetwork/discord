import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileFourCorySourceLinks} from '../src/aquapedia-cory-four-reconciliation.mjs';
const read=x=>JSON.parse(fs.readFileSync(new URL(x,import.meta.url),'utf8'));
const cory=read('./fixtures/corydoraspedia-thread-review-20261021.json').records.map(x=>({...x,group:'corydoras'}));
const receipts=read('../resources/aquapedia-cory-four-live-receipts-20261022.json');
const guppy=read('../resources/aquapedia-guppy-all-48-live-release-20261022.json');
const manifest=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
test('four Cory source links verified; 91 historical proposals still require review',()=>{
 const o=reconcileFourCorySourceLinks(cory,receipts,guppy,manifest);
 assert.equal(o.corySourceLinksVerified,4);
 assert.equal(o.guppyStandardIndexLinks,48);
 assert.equal(o.pendingCrossTaxaProposals,91);
 assert.equal(o.pendingActive,55);
 assert.equal(o.pendingArchived,36);
 assert.deepEqual(o.pendingByGroup,{corydoras:6,pleco:85});
 assert.equal(o.otherPublicationsAuthorized,false);
 assert.equal(o.discordWritesInReconciliation,0);
});
test('tampered bot message, altered source, and source status drift fail closed',()=>{
 const bad={...receipts,topics:receipts.topics.map((x,i)=>i===0?{...x,messageSha256:'x'}:x)};
 assert.throws(()=>reconcileFourCorySourceLinks(cory,bad,guppy,manifest),/Cory source-only receipt reconciliation/);
 assert.throws(()=>reconcileFourCorySourceLinks(cory.slice(1),receipts,guppy,manifest),/Cory source-only receipt reconciliation/);
 assert.throws(()=>reconcileFourCorySourceLinks(cory,receipts,guppy,{...manifest,publicationAuthorized:true}),/Cory source-only receipt reconciliation/);
});
