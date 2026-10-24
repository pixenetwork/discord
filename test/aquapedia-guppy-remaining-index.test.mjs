import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildRemainingGuppyIndex,GUPPY_REMAINING_TOPIC_SPECS} from '../src/aquapedia-guppy-remaining-index.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-source-20261021.json',import.meta.url),'utf8'));
test('three new index messages cover precisely GUP-011–048 without duplicates or pedigrees',()=>{
 const all=Object.keys(GUPPY_REMAINING_TOPIC_SPECS).map(x=>buildRemainingGuppyIndex(rows,x));
 assert.deepEqual(all.map(x=>x.entryUrls.length),[19,6,13]);
 assert.equal(new Set(all.flatMap(x=>x.entryUrls)).size,38);
 assert.equal(all.reduce((n,x)=>n+x.entryUrls.length,0),38);
 assert.ok(all.every(x=>x.content.length<=1900&&x.content.includes('not a verified pedigree')&&x.photos===0&&!x.claimVerified));
 assert.ok(all.every(x=>x.content.includes(x.marker)&&!x.content.includes('REVIEW PREVIEW')));
 assert.equal(all[0].threadId,all[1].threadId);
 assert.notEqual(all[1].threadId,all[2].threadId);
});
test('rejects status drift, duplicate route, and unsupported topic',()=>{
 assert.throws(()=>buildRemainingGuppyIndex(rows,'unknown'),/Remaining Guppy index/);
 assert.throws(()=>buildRemainingGuppyIndex(rows.slice(1),'tail'),/Remaining Guppy index/);
 assert.throws(()=>buildRemainingGuppyIndex(rows.map((x,i)=>i===40?{...x,name:'Unknown'}:x),'tail'),/Remaining Guppy index/);
});
