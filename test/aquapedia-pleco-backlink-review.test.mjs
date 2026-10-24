import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoArticleBacklinkReview} from '../src/aquapedia-pleco-backlink-review.mjs';
const records=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const snapshot=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-thread-parity-20261021.json',import.meta.url),'utf8'));
test('167 bot-owned Pleco research threads preserve 82 existing links and propose only 85 missing',()=>{
 const r=buildPlecoArticleBacklinkReview(records,snapshot);
 assert.equal(r.total,167);
 assert.equal(r.existingBacklinks,82);
 assert.equal(r.missingBacklinks,85);
 assert.equal(r.drafts.length,85);
 assert.equal(r.publicationAuthorized,false);
 assert.equal(r.discordWrites,0);
 assert.equal(r.newThreadsToCreate,0);
 assert.equal(r.existingBacklinks+r.drafts.length,167);
 assert.ok(r.drafts.every(x=>x.content.includes('Research draft — independent review pending')));
 assert.ok(r.drafts.every(x=>x.content.includes('https://aquapedia.app/plecopedia/research/')));
 assert.ok(r.drafts.every(x=>x.content.includes('not proof of a breeding origin')));
 assert.ok(r.drafts.every(x=>x.publicationAuthorized===false && x.newThreadRequested===false));
 assert.ok(r.drafts.every(x=>x.content.length<1900));
 assert.ok(!r.drafts.some(x=>x.content.includes('@everyone')||x.content.includes('@here')));
});
test('one historical name alias maps to existing thread, never a second Pleco research thread',()=>{
 const r=buildPlecoArticleBacklinkReview(records,snapshot);
 assert.equal(r.aliases.length,1);
 assert.equal(r.aliases[0].url,'/plecopedia/research/soromoni-stearleyi/');
 assert.equal(r.aliases[0].existingThreadId,'1561147018473381900');
 assert.equal(r.publicationAuthorized,false);
});
test('archive state is reported for editorial follow-up without unarchiving or publishing',()=>{
 const r=buildPlecoArticleBacklinkReview(records,snapshot);
 assert.equal(r.totalArchivedTargets,30);
 assert.equal(r.archivedDraftTargets,r.drafts.filter(x=>x.archived).length);
 assert.equal(r.archiveMutations,0);
});
test('unexpected source/Discord change fails closed, never converts a draft to authorized release',()=>{
 const change=x=>({...snapshot,records:snapshot.records.map((row,i)=>i===0?x(row):row)});
 assert.throws(()=>buildPlecoArticleBacklinkReview(records.slice(1),snapshot),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records.map((x,i)=>i===0?{...x,status:'Published'}:x),snapshot),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records,change(x=>({...x,botOwned:false}))),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records,change(x=>({...x,externalSources:false}))),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records,change(x=>({...x,sampledMessages:25}))),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records,change(x=>({...x,threadId:snapshot.records[1].threadId}))),/Pleco backlink review/);
 assert.throws(()=>buildPlecoArticleBacklinkReview(records,change(x=>({...x,articleLinked:'true'}))),/Pleco backlink review/);
});
