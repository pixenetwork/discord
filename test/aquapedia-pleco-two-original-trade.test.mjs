import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLECO_TWO_ORIGINAL_TRADE,buildPlecoOriginalTradeIndex} from '../src/aquapedia-pleco-two-original-trade.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('L239 and L398 only, exact DOI and original thread, no specimen/genetic authentication',()=>{
 const keys=Object.keys(PLECO_TWO_ORIGINAL_TRADE);
 assert.deepEqual(keys,['l239','l398']);
 const plans=keys.map(k=>buildPlecoOriginalTradeIndex(catalog,k));
 assert.equal(new Set(plans.map(x=>x.threadId)).size,2);
 assert.ok(plans.every(x=>x.content.includes('NOT authenticate')&&x.content.includes(x.marker)));
 assert.ok(plans.every(x=>x.content.includes('https://doi.org/'+x.doi)));
 assert.ok(plans.every(x=>x.attachments===0&&!x.liveSpecimenVerified&&!x.breedingPedigreeVerified));
 assert.equal(plans[0].name,'Baryancistrus beggini');
 assert.equal(plans[1].name,'Panaqolus tankei');
});
test('cannot release broader trade labels, changed source, or promoted unreviewed article',()=>{
 assert.throws(()=>buildPlecoOriginalTradeIndex(catalog,'l397'),/Pleco two original-trade source/);
 assert.throws(()=>buildPlecoOriginalTradeIndex(catalog,'l015'),/Pleco two original-trade source/);
 assert.throws(()=>buildPlecoOriginalTradeIndex(catalog.slice(1),'l239'),/Pleco two original-trade source/);
 assert.throws(()=>buildPlecoOriginalTradeIndex(catalog.map(x=>x.slug==='l398'?{...x,status:'published'}:x),'l398'),/Pleco two original-trade source/);
});
