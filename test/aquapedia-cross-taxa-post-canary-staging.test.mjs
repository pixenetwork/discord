import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stageCrossTaxaPostCanary,stageCrossTaxaAfterAllGuppyIndexes} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';

const json=relative=>JSON.parse(fs.readFileSync(new URL(relative,import.meta.url),'utf8'));
const frozen=json('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const guppies=json('./fixtures/guppypedia-source-20261021.json');
const receipt=json('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const later=json('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const canaryId='guppy:show-phenotype-index:index-base-1';

test('receipt-filtered pending queue has 62 active + 36 held, not 63 active',()=>{
 const stage=stageCrossTaxaPostCanary(frozen,guppies,receipt);
 assert.equal(stage.schema,'aquapedia.cross-taxa.post-canary-review.v1');
 assert.equal(stage.originalProposalCount,99);
 assert.equal(stage.pendingCount,98);
 assert.equal(stage.activeProposalCount,62);
 assert.equal(stage.archivedHeld,36);
 assert.deepEqual(stage.byGroup,{guppy:3,corydoras:4,pleco:55});
 assert.deepEqual(stage.batches.map(x=>x.items.length),[12,12,12,12,12,2]);
 assert.equal(stage.completedProposalId,canaryId);
 assert.equal(stage.completedMessageUrl,receipt.url);
 assert.equal(stage.completedVerifiedHistoricalReceipt,true);
 assert.equal(stage.completedRequiresFreshLiveReadback,true);
 assert.equal(stage.canPublish,false);
 assert.equal(stage.publicationAuthorized,false);
 assert.equal(stage.discordWrites,0);
 assert.equal(stage.newThreadsToCreate,0);
 assert.equal(stage.batchSize,12);
});
test('no completed canary appears in active, archived, receipt or batch output',()=>{
 const plan=stageCrossTaxaPostCanary(frozen,guppies,receipt);
 const pending=plan.batches.flatMap(x=>x.items);
 const archived=plan.archived;
 const historic=frozen.proposals.find(x=>x.id===canaryId);
 assert.equal(pending.length,62);
 assert.equal(archived.length,36);
 assert.ok(pending.every(x=>x.id!==canaryId&&!x.archived));
 assert.ok(archived.every(x=>x.id!==canaryId&&x.archived));
 assert.equal(new Set([...pending,...archived].map(x=>x.receiptKey)).size,98);
 assert.ok([...pending,...archived].every(x=>x.receiptKey!==historic.receiptKey));
 assert.ok(plan.batches.every(x=>x.canPublish===false&&x.requiresFreshPreflight===true));
 assert.deepEqual(Object.fromEntries(
  ['guppy','corydoras','pleco'].map(g=>[g,pending.filter(x=>x.group===g).length])
 ),{guppy:3,corydoras:4,pleco:55});
});
test('reject forged approvals, altered canary proof, tampered review manifest and catalog',()=>{
 for(const variant of [
  [frozen,guppies,{...receipt,verified:false}],
  [frozen,guppies,{...receipt,messageId:'123456789012345678'}],
  [frozen,guppies,{...receipt,sourceEntryIds:['gup-011',...receipt.sourceEntryIds.slice(1)]}],
  [{...frozen,publicationAuthorized:true},guppies,receipt],
  [{...frozen,proposals:frozen.proposals.slice(1)},guppies,receipt],
  [frozen,guppies.slice(1),receipt]
 ]){
  assert.throws(()=>stageCrossTaxaPostCanary(...variant),
   /Cross-taxa receipt reconciliation|Guppy base index canary|Active staging|Post-canary review/);
 }
});
test('historic original 99-item and earlier 63-active artifacts remain unchanged',()=>{
 assert.equal(frozen.proposals.length,99);
 const originalActive=frozen.proposals.filter(x=>!x.archived);
 assert.equal(originalActive.length,63);
 assert.ok(originalActive.some(x=>x.id===canaryId));
 const pending=stageCrossTaxaPostCanary(frozen,guppies,receipt);
 assert.ok(pending.batches.flatMap(x=>x.items).every(p=>p.publicationAuthorized===false));
});

test('all four historically verified Guppy indices are excluded, leaving 95 review proposals',()=>{
 const p=stageCrossTaxaAfterAllGuppyIndexes(frozen,guppies,receipt,later);
 assert.equal(p.schema,'aquapedia.cross-taxa.all-guppy-indexes-review.v1');
 assert.equal(p.guppyIndexMessagesVerifiedByStoredReceipts,4);
 assert.equal(p.guppyShowStandardSourceEntries,48);
 assert.equal(p.heldUnverifiedGuppyTradeLabels,128);
 assert.equal(p.pendingCount,95);
 assert.equal(p.activeCount,59);
 assert.equal(p.archivedHeld,36);
 assert.deepEqual(p.byGroup,{guppy:0,corydoras:10,pleco:85});
 assert.deepEqual(p.activeByGroup,{guppy:0,corydoras:4,pleco:55});
 assert.deepEqual(p.batches.map(x=>x.items.length),[12,12,12,12,11]);
 assert.ok(p.batches.every(x=>x.canPublish===false&&x.requiresFreshPreflight===true));
 assert.equal(p.publicationAuthorized,false);
 assert.equal(p.discordWrites,0);
 const items=[...p.batches.flatMap(x=>x.items),...p.archived];
 assert.equal(items.length,95);
 assert.equal(new Set(items.map(x=>x.receiptKey)).size,95);
 assert.ok(items.every(x=>x.group!=='guppy'&&x.publicationAuthorized===false));
});
test('other bots or altered source URLs cannot impersonate Guppy completion',()=>{
 const modified={...later,topics:later.topics.map((x,i)=>i===1?{...x,sourceUrls:[...x.sourceUrls].reverse()}:x)};
 assert.throws(()=>stageCrossTaxaAfterAllGuppyIndexes(frozen,guppies,receipt,modified),
  /Guppy final source-index reconciliation|Post-canary review/);
 const wrong={...later,topics:later.topics.map((x,i)=>i===2?{...x,threadId:'123456789012345678'}:x)};
 assert.throws(()=>stageCrossTaxaAfterAllGuppyIndexes(frozen,guppies,receipt,wrong),
  /Guppy final source-index reconciliation|Post-canary review/);
});
