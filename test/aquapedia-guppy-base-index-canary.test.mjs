import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGuppyBaseIndexCanary,GUPPY_BASE_INDEX_MARKER,GUPPY_BASE_THREAD_ID} from '../src/aquapedia-guppy-base-index-canary.mjs';
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-source-20261021.json',import.meta.url),'utf8'));
test('source-only canary is a concise ten-link working directory, not a genetic claim',()=>{
 const result=buildGuppyBaseIndexCanary(source);
 assert.equal(result.recordIds.length,10);
 assert.equal(result.threadId,GUPPY_BASE_THREAD_ID);
 assert.equal(result.marker,GUPPY_BASE_INDEX_MARKER);
 assert.ok(result.content.length<1500);
 assert.ok(result.content.includes('IKGH'));
 assert.ok(result.content.includes('not a verified pedigree'));
 assert.ok(result.content.includes(result.marker));
 assert.ok(!result.content.includes('@everyone')&&!result.content.includes('@here'));
 assert.ok(!result.content.includes('REVIEW PREVIEW'));
 assert.ok(result.recordIds.every(id=>result.content.includes('https://aquapedia.app/guppypedia/entries/'+id+'/')));
 assert.deepEqual(result.recordIds,Array.from({length:10},(_,i)=>'gup-'+String(i+1).padStart(3,'0')));
 assert.equal(result.independentLineageVerified,false);
 assert.equal(result.mediaAttachments,0);
});
test('malformed records, extra trade labels or changed IKGH identifiers fail closed',()=>{
 assert.throws(()=>buildGuppyBaseIndexCanary(source.slice(0,175)),/Guppy base index canary/);
 assert.throws(()=>buildGuppyBaseIndexCanary(source.map((x,i)=>i===0?{...x,name:'Unexpected color'}:x)),/Guppy base index canary|IKGH crosswalk/);
 assert.throws(()=>buildGuppyBaseIndexCanary(source.map((x,i)=>i===1?{...x,url:'/guppypedia/entries/gup-005/'}:x)),/Guppy base index canary|IKGH crosswalk/);
});
