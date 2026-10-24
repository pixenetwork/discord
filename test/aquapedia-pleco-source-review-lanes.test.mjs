import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyPlecoSourceReview} from '../src/aquapedia-pleco-source-review-lanes.mjs';
const load=file=>JSON.parse(fs.readFileSync(new URL('../resources/'+file,import.meta.url),'utf8'));
const plan=load('aquapedia-cross-taxa-release-review-20261021.json');
const citations=load('aquapedia-cross-taxa-citation-presence-20261021.json');
const head=load('aquapedia-external-source-head-20261022.json');

test('85 Pleco links route to 55 active + 30 archived; six restricted source cases held',()=>{
 const result=classifyPlecoSourceReview(plan,citations,head);
 assert.equal(result.plecoCandidates,85);
 assert.equal(result.activeReview,55);
 assert.equal(result.archivedHeld,30);
 assert.equal(result.accessRestrictedReview,6);
 assert.equal(result.restrictedActive,3);
 assert.equal(result.restrictedArchived,3);
 assert.equal(result.headReachableUnverified,79);
 assert.equal(result.activeOther,52);
 assert.equal(result.archivedOther,27);
 assert.equal(result.releaseAuthorized,false);
 assert.equal(result.claimsVerified,0);
 assert.equal(result.photoLicensesApproved,0);
 assert.equal(result.discordWrites,0);
 assert.equal(new Set(result.rows.map(r=>r.existingThreadId)).size,85);
 assert.ok(result.rows.every(x=>!x.canPublish&&!x.sourceClaimVerified&&!x.mediaReuseApproved));
});
test('restricted 403 sources are review holds, not broken citations or content approvals',()=>{
 const result=classifyPlecoSourceReview(plan,citations,head);
 const pages=result.rows.filter(x=>x.sourceAccessLane==='ACCESS_RESTRICTED_REVIEW');
 assert.deepEqual(pages.map(x=>x.sourceUrl).sort(),head.affectedUrls.slice().sort());
 assert.equal(pages.filter(x=>x.threadLane==='ACTIVE_REVIEW').length,3);
 assert.equal(pages.filter(x=>x.threadLane==='ARCHIVED_HOLD').length,3);
 assert.ok(pages.every(x=>!x.canPublish));
 assert.match(result.analysisType,/403 does not prove/);
});
test('changed source, unsafe targets, duplicate IDs or editorial flag escalation fails closed',()=>{
 const alt=(...args)=>classifyPlecoSourceReview(...args);
 assert.throws(()=>alt({...plan,publicationAuthorized:true},citations,head),/Pleco source-review lanes/);
 assert.throws(()=>alt(plan,citations,{...head,affectedUrls:[]}),/Pleco source-review lanes/);
 const reordered={...plan,proposals:plan.proposals.map(p=>p.group==='pleco'?{...p,approval:'granted'}:p)};
 assert.throws(()=>alt(reordered,citations,head),/Pleco source-review lanes/);
 const badThreads={...plan,proposals:plan.proposals.map(p=>p.group==='pleco'?{...p,existingThreadId:'1'}:p)};
 assert.throws(()=>alt(badThreads,citations,head),/Pleco source-review lanes/);
 const missing={...citations,records:citations.records.slice(1)};
 assert.throws(()=>alt(plan,missing,head),/Pleco source-review lanes/);
});
