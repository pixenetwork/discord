import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoThreeDirectSourceIndex,PLECO_THREE_DIRECT_DESCRIPTIONS} from '../src/aquapedia-pleco-three-direct-descriptions.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('direct-description source index lists three exact existing bot-owned Pleco targets',()=>{
 const keys=Object.keys(PLECO_THREE_DIRECT_DESCRIPTIONS);
 assert.deepEqual(keys,['hyp-contradens','hyp-parkateje','pseudo-sidereus']);
 const plans=keys.map(x=>buildPlecoThreeDirectSourceIndex(catalog,x));
 assert.equal(new Set(plans.map(x=>x.threadId)).size,3);
 assert.ok(plans.every(x=>x.pageUrl.startsWith('https://aquapedia.app/plecopedia/research/')));
 assert.ok(plans.every(x=>x.content.includes('does not authenticate')&&!x.claimVerified&&!x.specimenAuthenticated&&x.photos===0));
 assert.ok(plans.every(x=>x.content.includes(x.doiUrl)&&x.content.includes(x.marker)&&x.content.length<=1300));
 assert.ok(plans[0].doiUrl.includes('%5B62%3A'));
 assert.ok(plans[2].content.includes('generic placement requires separate review'));
});
test('status changes, missing cohort and unspecified aliases fail closed',()=>{
 assert.throws(()=>buildPlecoThreeDirectSourceIndex(catalog,'hyp-vandragti'),/Pleco three-direct-source plan/);
 assert.throws(()=>buildPlecoThreeDirectSourceIndex(catalog,'pana-changae'),/Pleco three-direct-source plan/);
 assert.throws(()=>buildPlecoThreeDirectSourceIndex(catalog.slice(1),'hyp-parkateje'),/Pleco three-direct-source plan/);
 assert.throws(()=>buildPlecoThreeDirectSourceIndex(catalog.map(x=>x.slug==='hyp-parkateje'?{...x,status:'Verified'}:x),'hyp-parkateje'),/Pleco three-direct-source plan/);
});
