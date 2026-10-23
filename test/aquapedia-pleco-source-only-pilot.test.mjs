import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoSourceOnlyPilot,PLECO_SOURCE_ONLY_CANDIDATES} from '../src/aquapedia-pleco-source-only-pilot.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('five Pleco research-link messages are scoped to exact known research drafts',()=>{
 const keys=Object.keys(PLECO_SOURCE_ONLY_CANDIDATES);
 assert.equal(keys.length,5);
 const plans=keys.map(k=>buildPlecoSourceOnlyPilot(fixture,k));
 assert.equal(new Set(plans.map(x=>x.threadId)).size,5);
 assert.ok(plans.every(x=>x.pageUrl.startsWith('https://aquapedia.app/plecopedia/research/')));
 assert.ok(plans.every(x=>x.content.includes('independent verification pending')&&!x.claimsVerified&&x.photos===0));
 assert.ok(plans.every(x=>x.content.includes('https://doi.org/')&&x.content.length<1100));
 assert.ok(plans.every(x=>x.content.includes(x.marker)));
});
test('reject missing, changed or promoted Pleco research source',()=>{
 assert.throws(()=>buildPlecoSourceOnlyPilot(fixture,'unknown'),/Pleco source-only pilot/);
 assert.throws(()=>buildPlecoSourceOnlyPilot(fixture.slice(1),'anc-leoni'),/Pleco source-only pilot/);
 assert.throws(()=>buildPlecoSourceOnlyPilot(fixture.map(x=>x.slug==='anc-leoni'?{...x,status:'verified'}:x),'anc-leoni'),/Pleco source-only pilot/);
});
