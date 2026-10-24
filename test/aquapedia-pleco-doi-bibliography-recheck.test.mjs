import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const first=read('../resources/aquapedia-pleco-24-doi-bibliography-20261023.json');
const verified=read('../resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json');
const queue=read('../resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
test('the repaired DOI registry ledger has exact authoritative identities for all 24 citations',()=>{
 assert.equal(first.results.length,24);
 assert.equal(verified.rows.length,24);
 assert.equal(verified.counts.metadataFound,24);
 assert.equal(verified.counts.exactDoiMatch,24);
 assert.equal(verified.counts.recovered,9);
 assert.equal(verified.counts.unresolved,0);
 assert.equal(verified.rows.filter(x=>x.metadata.registry==='Crossref').length,20);
 assert.equal(verified.rows.filter(x=>x.metadata.registry==='DataCite').length,4);
 for(const x of verified.rows){
  assert.equal(x.registryDoiExactMatch,true);
  assert.equal(x.metadata.resolvedDoi,x.doi);
  assert.ok(x.metadata.title.trim());
  assert.ok(Number(x.metadata.year)>=1900 && Number(x.metadata.year)<=2026);
  assert.equal(x.claimVerified,false);
  assert.equal(x.mediaRightsVerified,false);
 }
});
test('every DOI bibliography linkage maps to a real, explicitly held Pleco proposal',()=>{
 const byId=new Map(queue.rows.map(x=>[x.proposal_id,x]));
 const seen=new Set();
 for(const r of verified.rows){
  for(const id of r.usedBy){
   const proposal=byId.get(id);
   assert.ok(proposal, 'unknown Pleco record '+id);
   assert.ok(proposal.evidence.some(x=>decodeURIComponent(new URL(x.url).pathname.slice(1)).toLowerCase()===r.doi));
   assert.equal(proposal.post_authorized,false);
   assert.equal(proposal.source_claim_verified,false);
   seen.add(id);
  }
 }
 assert.equal(seen.size,29);
 assert.equal(queue.counts.total,55);
});
test('primary captive-breeding article is distinguishable from descriptive taxonomic citations',()=>{
 const matches=verified.rows.filter(x=>/captive breeding/i.test(x.metadata.title));
 assert.deepEqual(matches.map(x=>x.doi),['10.1007/s10499-024-01720-z']);
 assert.deepEqual(matches[0].usedBy,['pleco:research-article-backlink:study-l333-captive']);
 assert.ok(verified.rows.some(x=>x.doi==='10.11646/zootaxa.4552.1.1'&&/description of six new species/i.test(x.metadata.title)));
});
