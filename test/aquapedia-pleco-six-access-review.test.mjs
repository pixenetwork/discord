import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=x=>JSON.parse(fs.readFileSync(new URL('../resources/'+x,import.meta.url),'utf8'));
const review=read('aquapedia-pleco-six-access-review-20261023.json');
const head=read('aquapedia-external-source-head-20261022.json');
const presence=read('aquapedia-cross-taxa-citation-presence-20261021.json');
const base='https://aquapedia.app/plecopedia/research/';
const validUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}};

test('every one of the six restricted-source pages has an independently scoped review entry',()=>{
 assert.equal(review.schema,'aquapedia.pleco-six-access-review.v1');
 assert.equal(review.records.length,6);
 assert.equal(review.counts.review_records,6);
 assert.equal(review.counts.all_original_link_holds_remaining,6);
 assert.deepEqual(
  review.records.map(x=>base+x.slug+'/').sort(),
  head.affectedUrls.slice().sort()
 );
 const origins=new Map(presence.records.map(x=>[x.url,x.links]));
 for(const r of review.records){
  assert.ok(origins.has(base+r.slug+'/'));
  assert.ok(origins.get(base+r.slug+'/').includes(r.original));
  assert.ok(validUrl(r.original));
  assert.ok(r.claim_type&&r.status);
  assert.ok(Array.isArray(r.alternatives));
  assert.ok(Array.isArray(r.unverified)&&r.unverified.length>0);
  for(const ref of r.alternatives){
   assert.ok(validUrl(ref.url));
   assert.ok(ref.supports.length>25);
   assert.ok(!ref.url.includes('aquapedia.app'));
  }
 }
});
test('independent evidence must not silently approve claims, photo rights or publishing',()=>{
 const gate=review.release;
 assert.equal(gate.claim_level_approved,0);
 assert.equal(gate.external_photo_rights_approved,0);
 assert.equal(gate.publishing_authorized,false);
 assert.equal(gate.discord_writes,0);
 assert.equal(gate.source_urls_replaced,0);
 assert.equal(review.counts.taxonomy_partially_corroborated,2);
 assert.equal(review.counts.independent_breeder_self_reports_found,2);
 assert.equal(review.counts.indexed_primary_breeder_reports_partially_corroborated,1);
 const originalForumOnly=review.records.filter(r=>r.status==='ORIGINAL_FORUM_REQUIRES_ACCESS');
 assert.deepEqual(originalForumOnly.map(r=>r.slug),['breeder-davej-l134']);
 const karsten=review.records.find(r=>r.slug==='breeder-karsten-l183');
 assert.equal(karsten.status,'ORIGINAL_FORUM_PUBLIC_SEARCH_EXCERPT_WITH_IDENTITY_CAUTION');
 assert.ok(karsten.unverified.some(x=>x.includes('L181')));
 assert.ok(karsten.alternatives.some(x=>x.url.includes('l-welse.com')));
 const taxonomic=review.records.filter(r=>r.slug==='l025'||r.slug==='l037');
 assert.ok(taxonomic.every(x=>x.unverified.length>0));
 const l037=review.records.find(x=>x.slug==='l037');
 assert.equal(l037.status,'CANONICAL_TAXONOMY_CITATIONS_STAGED_NOT_RELEASED');
 assert.equal(l037.canonicalization.zenodo_request_record_id,'17162021');
 assert.equal(l037.canonicalization.canonical_zenodo_record_id,'17162022');
 assert.equal(l037.canonicalization.canonical_doi,'https://doi.org/10.5281/zenodo.17162022');
 assert.equal(l037.canonicalization.original_publication_doi,'https://doi.org/10.1590/S1679-62252008000300012');
 assert.equal(l037.canonicalization.live_site_deployed,false);
 assert.equal(l037.canonicalization.photo_or_claim_release_granted,false);
 assert.ok(l037.unverified.some(x=>x.includes('staged only')));
});
