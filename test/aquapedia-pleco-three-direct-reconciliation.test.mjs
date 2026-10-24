import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileThreeDirectPlecoDescriptions} from '../src/aquapedia-pleco-three-direct-reconciliation.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=read('./fixtures/plecopedia-public-source-20261021.json');
const receipts=read('../resources/aquapedia-pleco-three-direct-live-receipts-20261023.json');
const historical=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const first=read('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const seven=read('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
test('three directly supported source indexes leave 40 active Pleco and 36 archived holds',()=>{
 const r=reconcileThreeDirectPlecoDescriptions(catalog,receipts,historical,first,seven);
 assert.equal(r.verifiedDirectDescriptionMessages,3);
 assert.equal(r.pendingCount,76);
 assert.equal(r.activePleco,40);
 assert.equal(r.archivedHeld,36);
 assert.deepEqual(r.byGroup,{pleco:70,corydoras:6});
 assert.equal(r.remainingPublicationAuthorized,false);
 assert.equal(r.scientificClaimVerified,false);
 assert.equal(r.discordWritesInReconciliation,0);
});
test('receipt author, hash, target thread, source drift or approval escalation fails closed',()=>{
 for(const p of [
  {...receipts,verified:false},
  {...receipts,records:receipts.records.map((x,i)=>i===0?{...x,contentSha256:'0'.repeat(64)}:x)},
  {...receipts,records:receipts.records.map((x,i)=>i===0?{...x,threadId:'999999999999999999'}:x)},
  {...receipts,records:receipts.records.map((x,i)=>i===0?{...x,messageId:receipts.records[1].messageId}:x)},
  {...receipts,records:receipts.records.slice(1)}
 ])assert.throws(()=>reconcileThreeDirectPlecoDescriptions(catalog,p,historical,first,seven),/Pleco direct-description receipts/);
 assert.throws(()=>reconcileThreeDirectPlecoDescriptions(catalog,receipts,{...historical,publicationAuthorized:true},first,seven),/Pleco direct-description receipts/);
});
