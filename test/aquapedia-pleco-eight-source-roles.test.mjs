import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const roles=read('../resources/aquapedia-pleco-eight-source-roles-20261024.json');
const live=read('../resources/aquapedia-pleco-eight-live-citation-readback-20261024.json');
const original=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
test('eight research roles remain in frozen review inventory and never imply publication approval',()=>{
 assert.equal(roles.records.length,8);
 assert.equal(new Set(roles.records.map(x=>x.slug)).size,8);
 assert.equal(roles.publicationAuthorized,false);
 assert.equal(roles.discordWrites,0);
 for(const x of roles.records){
  const id='pleco:research-article-backlink:'+x.slug;
  const row=original.proposals.find(x=>x.id===id);
  assert.ok(row,id);
  assert.equal(row.archived,false);
  assert.equal(row.sourceUrls.join('|'),'https://aquapedia.app/plecopedia/research/'+x.slug+'/');
  assert.ok(x.reviewResult.includes('hold')||x.reviewResult.startsWith('original-link-candidate'));
  assert.ok(x.claimsNotProven.length>0);
 }
});
test('eight live Aquapedia pages retained exact citations but did not validate scientific identity',()=>{
 assert.equal(live.currentQueue,72);
 assert.equal(live.counts.checked,8);
 assert.equal(live.counts.http200,8);
 assert.equal(live.counts.exactCitationPresent,8);
 assert.equal(live.counts.exactCitationMissing,0);
 assert.equal(live.publicationAuthorized,false);
 assert.equal(live.publishedLinksDuringAudit,0);
 for(const r of live.results){
  const item=roles.records.find(x=>x.slug===r.slug);
  assert.ok(item);
  assert.equal(r.pageHttp,200);
  assert.equal(r.status,'Research draft — independent review pending');
  assert.equal(r.exactCitationPresent,true);
  assert.equal(r.originalSourceUrl,item.source);
  assert.equal(r.independentClaimVerification,false);
  assert.equal(r.proposedReleaseApproved,false);
  assert.equal(r.discordWrites,0);
 }
});
test('species descriptions must not be substituted for distinct trade codes or breeding lineages',()=>{
 const by=Object.fromEntries(roles.records.map(x=>[x.slug,x]));
 assert.equal(by['l398'].taxonDescribed,'Panaqolus tankei');
 assert.equal(by['l398'].reviewResult,'original-link-candidate-after-live-thread-and-content-review');
 assert.equal(by['l239'].taxonDescribed,'Baryancistrus beggini');
 assert.match(by['l397'].interpretation,/not L397/i);
 assert.match(by['breeder-andreas-tanke-l398'].interpretation,/probably/);
 assert.equal(by['l191'].taxonDescribed,'Panaque titan');
 assert.equal(by['l418'].taxonDescribed,'Panaque titan');
 assert.match(by['l191'].interpretation,/uncertain|cf\./i);
 assert.match(by['l418'].interpretation,/Huallaga/);
 assert.match(by['bary-niveatus'].interpretation,/comparison/);
 assert.equal(by['l015'].taxonDescribed,'Peckoltia compta (L134), not L015');
 assert.equal(roles.records.filter(x=>x.reviewResult.endsWith('-hold')).length,6);
});
