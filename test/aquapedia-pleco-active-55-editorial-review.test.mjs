import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../resources/'+name,import.meta.url),'utf8'));
const review=read('aquapedia-pleco-active-55-editorial-review-20261023.json');
const proposals=read('aquapedia-cross-taxa-release-review-20261021.json').proposals;
const evidence=read('aquapedia-cross-taxa-citation-presence-20261021.json').records;
const head=read('aquapedia-external-source-head-20261022.json').checks;
const statuses=new Map(head.map(x=>[x.url,x.outcome]));
const citations=new Map(evidence.map(x=>[x.url,x.links]));
test('every active Pleco proposal appears exactly once with its existing thread and citations',()=>{
 const originals=proposals.filter(x=>x.group==='pleco'&&!x.archived);
 assert.equal(review.rows.length,55);
 assert.equal(originals.length,55);
 assert.equal(new Set(review.rows.map(x=>x.proposal_id)).size,55);
 assert.equal(new Set(review.rows.map(x=>x.existing_thread_id)).size,55);
 const indexed=new Map(originals.map(x=>[x.id,x]));
 for(const row of review.rows){
  const original=indexed.get(row.proposal_id);
  assert.ok(original,'all rows must originate in pinned historic proposal manifest');
  assert.equal(row.site_url,original.sourceUrls[0]);
  assert.equal(row.existing_thread_id,original.existingThreadId);
  assert.equal(row.receipt_key,original.receiptKey);
  assert.equal(row.archived,false);
  assert.equal(row.post_authorized,false);
  assert.equal(row.source_claim_verified,false);
  assert.equal(row.rights_approved,false);
  assert.equal(row.current_live_thread_readback_required,true);
  const originalSources=citations.get(row.site_url);
  assert.ok(Array.isArray(originalSources));
  assert.deepEqual(row.evidence.map(x=>x.url),originalSources);
  for(const src of row.evidence) assert.equal(src.head_outcome,statuses.get(src.url));
 }
});
test('review lanes prioritize DOI-format links but never treat reachability as scientific approval',()=>{
 const rank={'DOI_LINK_PRESENT_CLAIM_UNVERIFIED':0,'OTHER_REACHABLE_LINK_CLAIM_UNVERIFIED':1,'RESTRICTED_SOURCE_ACCESS':2};
 const counts={doi_link_present:0,other_reachable:0,restricted:0};
 let last=-1;
 for(const x of review.rows){
  const n=rank[x.editorial_lane];
  assert.ok(Number.isInteger(n));
  assert.ok(n>=last);last=n;
  const reachable=x.evidence.some(s=>s.head_outcome==='reachable_head');
  const doi=x.evidence.some(s=>s.url.startsWith('https://doi.org/'));
  if(n===0){counts.doi_link_present++;assert.ok(doi&&reachable);}
  if(n===1){counts.other_reachable++;assert.ok(!doi&&reachable);}
  if(n===2){counts.restricted++;assert.ok(!reachable);}
 }
 assert.deepEqual(counts,{doi_link_present:29,other_reachable:23,restricted:3});
 assert.deepEqual(review.counts,{total:55,...counts});
 assert.deepEqual(review.policy,{publication_authorized:false,source_claims_verified:0,photo_rights_approved:0,discord_writes:0,new_threads_to_create:0});
 assert.deepEqual(review.snapshots,{
  proposal_path:'resources/aquapedia-cross-taxa-release-review-20261021.json',
  citation_path:'resources/aquapedia-cross-taxa-citation-presence-20261021.json',
  source_head_path:'resources/aquapedia-external-source-head-20261022.json'
 });
 // Source contents are checked row-for-row above. The Git tree itself pins the
 // three source blobs without copying high-entropy object identifiers into data.
 assert.ok(!Object.keys(review.snapshots).some(key=>key.endsWith('_sha')));
 assert.ok(review.caveats.some(x=>x.includes('not mean')));
});
