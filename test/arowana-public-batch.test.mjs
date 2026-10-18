import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareArowanaPublicBatch } from '../src/arowana-public-batch.mjs';
import { buildAquapediaPost } from '../src/aquapedia-posts.mjs';
const cards = Array.from({length:10},(_,i)=>({
  id:'arowana.specimen-'+i,
  name:'Arowana record '+i,
  entityType:i<7?'species':'research', organismGroup:'arowana',
  summary:'Source-backed reference', description:'Taxon evidence',
  history:'Basin records', care:'Species-appropriate welfare',
  websiteUrl:'https://aquapedia.app/arowanapedia/specimen-'+i+'/',
  sources:['https://doi.org/10.1016/j.repbre.2023.12.001'], photos:[]
}));
const manifest={version:1,cards};
test('review gate remains closed by default',()=>{
  const result=prepareArowanaPublicBatch({manifest});
  assert.equal(result.status,'review_pending');
  assert.equal(result.discordPublicationApproved,false);
});
test('ten independently sourced cards become publishable after both approvals',()=>{
  const result=prepareArowanaPublicBatch({manifest,editorialApproved:true,publicAudienceApproved:true});
  assert.equal(result.cards.length,10);
  for(const card of result.cards){
    const post=buildAquapediaPost(card);
    assert.equal(post.allowedMentions.parse.length,0);
    assert.match(post.content,/Full research: https:\/\/aquapedia\.app\/arowanapedia\//);
    assert.ok(post.embeds[0].fields.some(f=>f.name==='Research sources'));
  }
});
test('reject duplicate IDs, off-domain pages, private IP sources or unlicensed imagery',()=>{
  for (const change of [
    c=>{c[1].id=c[0].id;},
    c=>{c[1].websiteUrl='https://example.com/arowanapedia/evil/';},
    c=>{c[1].sources=['https://192.168.0.1/admin'];},
    c=>{c[1].photos=[{url:'https://example.org/photo.jpg'}];},
  ]) {
    const mutated=structuredClone(manifest); change(mutated.cards);
    assert.throws(()=>prepareArowanaPublicBatch({manifest:mutated}));
  }
});
