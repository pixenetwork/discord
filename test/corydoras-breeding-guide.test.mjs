import test from 'node:test';
import assert from 'node:assert/strict';
import { guideContent } from '../tools/corydoras-breeding-guide-publisher.mjs';

const IDs=['434','473','306','356','336','352','410','419','490','253','488'];
const seed=IDs.map((recordKey,i)=>({kind:'directory',recordKey,threadId:String(1560800000000000000n+BigInt(i)),verified:true}));

test('breeding index only links verified preexisting species threads',()=>{
 const content=guideContent(seed);
 assert.ok(content.length<=2000);
 for(const id of IDs)assert.match(content,/Breeding|Panda|Sterbai/);
 assert.equal((content.match(/<#[0-9]{16,20}>/g)||[]).length,11);
 assert.match(content,/firsthand or specialist/);
 assert.match(content,/No photos, original-page text/);
 assert.match(content,/food/i);
});
test('missing, duplicate or unverified species records fail closed',()=>{
 assert.throws(()=>guideContent(seed.slice(1)),/Unverified\/duplicate directory record/);
 assert.throws(()=>guideContent([...seed,seed[0]]),/Unverified\/duplicate directory record/);
 assert.throws(()=>guideContent(seed.map((x,i)=>i===3?{...x,verified:false}:x)),/Unverified\/duplicate directory record/);
});
