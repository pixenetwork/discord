import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCorySectionLinkReview} from '../src/aquapedia-cory-section-link-review.mjs';
const snapshot=JSON.parse(fs.readFileSync(new URL('./fixtures/corydoraspedia-thread-review-20261021.json',import.meta.url),'utf8'));
const source=snapshot.records.map(({name,slug,url,type,status})=>({name,slug,url,type,status,group:'corydoras'}));

test('19 Corydoraspedia section links produce only source-preserving read-only review proposals',()=>{
 const result=buildCorySectionLinkReview(source,snapshot);
 assert.equal(result.total,19);
 assert.equal(result.publicationAuthorized,false);
 assert.equal(result.discordWrites,0);
 assert.equal(result.newThreadsToCreate,0);
 assert.equal(result.ambiguous.length,7);
 assert.equal(result.namingOrLineageReview.length,2);
 assert.equal(result.drafts.length,10);
 assert.equal(result.previouslyLinked,0);
 assert.equal(result.drafts.length+result.ambiguous.length+result.namingOrLineageReview.length,19);
 assert.ok(result.drafts.every(x=>x.content.includes('Research status: Keeper observation; not a universal target')));
 assert.ok(result.drafts.every(x=>x.content.includes('https://aquapedia.app/corydoraspedia/breeding/#')));
 assert.ok(result.drafts.every(x=>x.content.includes('not evidence of founding parentage')));
 assert.ok(result.drafts.every(x=>x.content.length<1900 && x.publicationAuthorized===false));
 assert.ok(result.drafts.every(x=>x.existingThreadId && x.newThreadRequested===false));
});
test('Red Laser source-to-CW number and Hoplisoma weitzmani spelling must be reviewed rather than auto-chosen',()=>{
 const out=buildCorySectionLinkReview(source,snapshot);
 assert.deepEqual(out.namingOrLineageReview.map(x=>x.slug).sort(),['hoplisoma-weitzmani-breeding','red-laser']);
 assert.ok(out.namingOrLineageReview.every(x=>x.candidates.length===1));
});
test('all seven dual-candidate morph records remain unresolved with both real thread links retained',()=>{
 const out=buildCorySectionLinkReview(source,snapshot);
 assert.ok(out.ambiguous.every(x=>x.candidates.length===2));
 assert.ok(out.ambiguous.every(x=>x.candidates.every(c=>c.threadUrl.startsWith('https://discord.com/channels/1519337502379475095/'))));
 assert.ok(!out.drafts.some(x=>out.ambiguous.some(y=>y.slug===x.slug)));
});
test('fail closed for missing/changed routes, bot ownership, source status, candidate collision',()=>{
 const altered=x=>({...snapshot,records:snapshot.records.map((r,i)=>i===0?x(r):r)});
 assert.throws(()=>buildCorySectionLinkReview(source.slice(1),snapshot),/Cory review/);
 assert.throws(()=>buildCorySectionLinkReview([...source.slice(1),{...source[0],url:'/corydoraspedia/lineages/#unknown'}],snapshot),/Cory review/);
 assert.throws(()=>buildCorySectionLinkReview(source,altered(r=>({...r,candidates:r.candidates.map((c,i)=>i===0?{...c,starterOwnedByBot:false}:c)}))),/Cory review/);
 assert.throws(()=>buildCorySectionLinkReview(source,altered(r=>({...r,candidates:r.candidates.map((c,i)=>i===0?{...c,parentId:'123'}:c)}))),/Cory review/);
 assert.throws(()=>buildCorySectionLinkReview(source,altered(r=>({...r,candidates:[r.candidates[0],r.candidates[0]]}))),/Cory review/);
 assert.throws(()=>buildCorySectionLinkReview(source,altered(r=>({...r,candidates:r.candidates.map((c,i)=>i===0?{...c,sourceLinkAlreadyPresent:true}:c)}))),/Cory review/);
});
