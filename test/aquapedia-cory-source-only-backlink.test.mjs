import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCorySourceOnlyBacklink,CORY_LINK_ONLY_TARGETS} from '../src/aquapedia-cory-source-only-backlink.mjs';
const records=JSON.parse(fs.readFileSync(new URL('./fixtures/corydoraspedia-thread-review-20261021.json',import.meta.url),'utf8')).records.map(r=>({...r,group:'corydoras'}));
test('only four unambiguous existing-species report backlinks are possible',()=>{
 const a=Object.keys(CORY_LINK_ONLY_TARGETS).map(key=>buildCorySourceOnlyBacklink(records,key));
 assert.equal(a.length,4);
 assert.equal(new Set(a.map(x=>x.threadId)).size,4);
 assert.ok(a.every(x=>x.pageUrl.includes('/corydoraspedia/breeding/#')));
 assert.ok(a.every(x=>x.content.includes('not a universal breeding parameter')===false&&x.content.includes('Not a universal breeding parameter')));
 assert.ok(a.every(x=>!x.publicationClaimsVerified&&x.photos===0&&x.content.length<1000));
});
test('unknown species, missing record, upgraded status or changed names fail closed',()=>{
 assert.throws(()=>buildCorySourceOnlyBacklink(records,'panda'),/Cory source-only backlink/);
 assert.throws(()=>buildCorySourceOnlyBacklink(records.slice(1),'burgessi'),/Cory source-only backlink/);
 assert.throws(()=>buildCorySourceOnlyBacklink(records.map(x=>x.slug==='hoplisoma-burgessi-breeding'?{...x,status:'fully verified'}:x),'burgessi'),/Cory source-only backlink/);
});
