import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const lane=read('../resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
const live=read('../resources/aquapedia-pleco-active-55-live-page-citations-20261023.json');
test('55 live Pleco research page URLs preserve exactly the reviewed bibliography',()=>{
 assert.equal(lane.rows.length,55);
 assert.equal(live.summary.checked,55);
 assert.equal(live.summary.pageHttp200,55);
 assert.equal(live.summary.stableCitationList,55);
 assert.equal(live.summary.missingPriorCitationPages,0);
 assert.equal(live.summary.newlyAddedCitationPages,0);
 assert.equal(live.summary.errorPages,0);
 assert.equal(live.summary.sourceStatusChanged,0);
 const byId=new Map(lane.rows.map(x=>[x.proposal_id,x]));
 assert.equal(new Set(live.rows.map(x=>x.proposalId)).size,55);
 for(const x of live.rows){
  const original=byId.get(x.proposalId);
  assert.ok(original);
  assert.equal(x.url,original.site_url);
  assert.equal(x.threadId,original.existing_thread_id);
  assert.equal(x.liveCitationCount,original.evidence.length);
  assert.deepEqual(x.missingPriorCitations,[]);
  assert.deepEqual(x.addedNewCitations,[]);
  assert.equal(x.siteStatus,'Research draft — independent review pending');
  assert.equal(x.ownerApproved,false);
  assert.equal(x.claimVerified,false);
  assert.equal(x.postAuthorized,false);
 }
});
test('live parity audit remains nonpublishing and does not infer photo or science approval',()=>{
 assert.equal(live.publicationAuthorized,false);
 assert.equal(live.discordWrites,0);
 assert.equal(live.sourceClaimsVerified,false);
 assert.equal(live.mediaRightsVerified,false);
});
