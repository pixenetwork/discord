import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileSevenPlecoTaxonomySources} from '../src/aquapedia-pleco-seven-taxonomy-reconciliation.mjs';
const read=x=>JSON.parse(fs.readFileSync(new URL(x,import.meta.url),'utf8'));
const catalog=read('./fixtures/plecopedia-public-source-20261021.json');
const proof=read('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
const prior=read('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const historical=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
test('seven independently read-back taxonomy posts leave only 43 active Pleco and 36 archived holds',()=>{
 const x=reconcileSevenPlecoTaxonomySources(catalog,proof,historical,prior);
 assert.equal(x.verifiedPlecoTaxonomyPosts,7);
 assert.equal(x.remaining,79);
 assert.equal(x.activePleco,43);
 assert.equal(x.archivedHeld,36);
 assert.deepEqual(x.byGroup,{pleco:73,corydoras:6});
 assert.equal(x.publicationAuthorized,false);
 assert.equal(x.discordWritesDuringReconciliation,0);
});
test('unverified receipt, duplicate ID, altered DOI, and mismatched source fail closed',()=>{
 for(const tampered of [
  {...proof,verified:false},
  {...proof,records:proof.records.map((x,i)=>i===0?{...x,contentSha256:'1'.repeat(64)}:x)},
  {...proof,records:proof.records.map((x,i)=>i===1?{...x,messageId:proof.records[0].messageId}:x)},
  {...proof,records:proof.records.slice(1)}
 ])assert.throws(()=>reconcileSevenPlecoTaxonomySources(catalog,tampered,historical,prior),/Pleco taxonomy receipt reconciliation/);
 assert.throws(()=>reconcileSevenPlecoTaxonomySources(catalog,proof,{...historical,publicationAuthorized:true},prior),/Pleco taxonomy receipt reconciliation/);
});
