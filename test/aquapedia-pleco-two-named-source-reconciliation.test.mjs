import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileTwoNamedPlecoSources} from '../src/aquapedia-pleco-two-named-source-reconciliation.mjs';
const get=x=>JSON.parse(fs.readFileSync(new URL(x,import.meta.url),'utf8'));
const c=get('./fixtures/plecopedia-public-source-20261021.json');
const proof=get('../resources/aquapedia-pleco-two-named-source-live-receipts-20261023.json');
const m=get('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const five=get('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const seven=get('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
const three=get('../resources/aquapedia-pleco-three-direct-live-receipts-20261023.json');
const two=get('../resources/aquapedia-pleco-two-nomenclature-live-receipts-20261023.json');
test('two new public named-species source indexes reconcile 72 remaining proposals',()=>{
 const result=reconcileTwoNamedPlecoSources(c,proof,m,five,seven,three,two);
 assert.equal(result.verifiedNamedSpeciesPosts,2);
 assert.equal(result.pendingCount,72);
 assert.equal(result.activePleco,36);
 assert.equal(result.archivedHeld,36);
 assert.deepEqual(result.byGroup,{pleco:66,corydoras:6});
 assert.equal(result.remainingPublicationAuthorized,false);
 assert.equal(result.discordWritesDuringReconciliation,0);
});
test('malformed, copied, or tampered source receipt cannot clear a pending proposal',()=>{
 for(const p of [
  {...proof,verified:false},
  {...proof,records:proof.records.map((x,i)=>i?{...x,messageSha256:'a'.repeat(64)}:x)},
  {...proof,records:proof.records.map((x,i)=>i?{...x,catalogUrl:'https://wrong.invalid/'}:x)},
  {...proof,records:proof.records.map((x,i)=>i?{...x,messageId:proof.records[0].messageId}:x)},
  {...proof,records:proof.records.slice(1)}
 ])assert.throws(()=>reconcileTwoNamedPlecoSources(c,p,m,five,seven,three,two),/Pleco two named-species receipts/);
 assert.throws(()=>reconcileTwoNamedPlecoSources(c,proof,{...m,publicationAuthorized:true},five,seven,three,two),/Pleco two named-species receipts/);
});
