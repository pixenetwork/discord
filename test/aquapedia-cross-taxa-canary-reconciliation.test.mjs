import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileSourceOnlyCanary} from '../src/aquapedia-cross-taxa-canary-reconciliation.mjs';
const json=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const manifest=json('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const catalog=json('./fixtures/guppypedia-source-20261021.json');
const receipt=json('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');

test('one live bot-authored and adopted source-only index removes exactly one review proposal',()=>{
 const r=reconcileSourceOnlyCanary(manifest,catalog,receipt);
 assert.equal(r.verifiedPostedSourceOnlyMessages,1);
 assert.equal(r.verifiedPublishedSourceEntries,10);
 assert.equal(r.remainingProposals,98);
 assert.equal(r.remainingActive,62);
 assert.equal(r.remainingArchived,36);
 assert.deepEqual(r.remainingByGroup,{guppy:3,corydoras:10,pleco:85});
 assert.equal(r.overallCrossTaxaReleaseAuthorized,false);
 assert.equal(r.discordWritesDuringReconciliation,0);
});
test('unverified, misplaced or altered canary proof never marks a pending release as done',()=>{
 for(const changed of [
  {...receipt,verified:false},
  {...receipt,threadId:'111111111111111111'},
  {...receipt,messageId:'999999999999999999'},
  {...receipt,messageSha256:'0'.repeat(64)},
  {...receipt,sourceEntryIds:[...receipt.sourceEntryIds.slice(0,-1),'gup-049']},
  {...receipt,actionVerified:'posted-only'},
  {...receipt,otherCrossTaxaProposalsPublished:true}
 ])assert.throws(()=>reconcileSourceOnlyCanary(manifest,catalog,changed),/Cross-taxa receipt reconciliation/);
});
test('cannot treat unreviewed cross-category entries as released',()=>{
 assert.throws(()=>reconcileSourceOnlyCanary({...manifest,publicationAuthorized:true},catalog,receipt),/Cross-taxa receipt reconciliation/);
 assert.throws(()=>reconcileSourceOnlyCanary(manifest,catalog.slice(1),receipt),/Guppy base index canary|Cross-taxa receipt reconciliation/);
});
