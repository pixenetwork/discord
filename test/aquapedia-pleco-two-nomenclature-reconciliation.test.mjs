import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileTwoPlecoNames} from '../src/aquapedia-pleco-two-nomenclature-reconciliation.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=read('./fixtures/plecopedia-public-source-20261021.json');
const r=read('../resources/aquapedia-pleco-two-nomenclature-live-receipts-20261023.json');
const manifest=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const first=read('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const seven=read('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
const three=read('../resources/aquapedia-pleco-three-direct-live-receipts-20261023.json');
test('two independently verified nomenclature source posts reduce queue from 76 to 74',()=>{
 const x=reconcileTwoPlecoNames(catalog,r,manifest,first,seven,three);
 assert.equal(x.verifiedNomenclatureMessages,2);
 assert.equal(x.pendingCount,74);
 assert.equal(x.activePleco,38);
 assert.equal(x.archivedHeld,36);
 assert.deepEqual(x.byGroup,{pleco:68,corydoras:6});
 assert.equal(x.remainingPublicationAuthorized,false);
 assert.equal(x.discordWritesDuringReconciliation,0);
});
test('falsified proof, original source, author or catalogue must be rejected',()=>{
 for(const candidate of [
  {...r,verified:false},
  {...r,records:r.records.map((v,i)=>i?{...v,originalReference:'https://wrong.invalid'}:v)},
  {...r,records:r.records.map((v,i)=>i?{...v,contentSha256:'0'.repeat(64)}:v)},
  {...r,records:r.records.map((v,i)=>i?{...v,messageId:r.records[0].messageId}:v)},
  {...r,records:r.records.slice(1)}
 ])assert.throws(()=>reconcileTwoPlecoNames(catalog,candidate,manifest,first,seven,three),/Pleco nomenclature receipt reconciliation/);
 assert.throws(()=>reconcileTwoPlecoNames(catalog,r,{...manifest,publicationAuthorized:true},first,seven,three),/Pleco nomenclature receipt reconciliation/);
});
