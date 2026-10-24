import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCrossTaxaReleaseGate} from '../src/aquapedia-cross-taxa-release-gate.mjs';
const fixture=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const catalog=[
 ...fixture('guppypedia-source-20261021.json'),
 ...fixture('plecopedia-public-source-20261021.json'),
 ...fixture('corydoraspedia-thread-review-20261021.json').records.map(({name,slug,url,type,status})=>({name,slug,url,type,status,group:'corydoras'}))
];
const snapshots={
 guppy:fixture('guppypedia-forum-starters-20261021.json'),
 cory:fixture('corydoraspedia-thread-review-20261021.json'),
 pleco:fixture('plecopedia-thread-parity-20261021.json')
};
const now='2026-10-22T02:10:00.000Z';
test('release gate combines existing-thread proposals without publishing or double-counting',()=>{
 const r=buildCrossTaxaReleaseGate(catalog,snapshots,{now});
 assert.deepEqual(r.counts,{guppy:4,corydoras:10,pleco:85,proposedMessages:99,activeTargets:63,archivedTargets:36,guppyTradeHeld:128,coryAmbiguousHeld:7,coryNamingHeld:2,plecoAlreadyLinked:82});
 assert.equal(r.publicationAuthorized,false);
 assert.equal(r.discordWrites,0);
 assert.equal(r.newThreadsToCreate,0);
 assert.equal(r.releaseEligibility,'BLOCKED_REVIEW_ONLY');
 assert.equal(r.proposals.length,99);
 assert.ok(r.proposals.every(x=>x.publicationAuthorized===false && x.existingThreadId && x.sourceUrls.length>0 && x.content.length<1900));
 assert.ok(r.proposals.every(x=>/^[0-9a-f]{64}$/.test(x.sha256) && x.approval==='not-granted'));
 assert.equal(new Set(r.proposals.map(x=>x.receiptKey)).size,99);
 assert.ok(r.proposals.every(x=>x.content.includes('NOT POSTED')||x.content.includes('NOT POSTED**')));
 assert.ok(r.proposals.every(x=>x.targetKind==='existing-thread'));
});
test('deterministic receipts and content hashes survive repeated dry runs',()=>{
 const a=buildCrossTaxaReleaseGate(catalog,snapshots,{now});
 const b=buildCrossTaxaReleaseGate(catalog,snapshots,{now});
 assert.deepEqual(a.proposals,b.proposals);
 assert.equal(a.snapshotFreshness.guppy.fresh,false);
 assert.equal(a.snapshotFreshness.cory.fresh,true);
 assert.equal(a.snapshotFreshness.pleco.fresh,true);
});
test('hold unsafe or changed catalog/snapshots rather than permitting a publish',()=>{
 const change=xs=>({ ...snapshots, ...xs });
 assert.throws(()=>buildCrossTaxaReleaseGate(catalog.slice(1),snapshots,{now}),/Cross-taxa release gate|IKGH crosswalk/);
 assert.throws(()=>buildCrossTaxaReleaseGate(catalog,change({guppy:{...snapshots.guppy,threads:snapshots.guppy.threads.slice(1)}}),{now}),/Cross-taxa release gate|Guppy index preview/);
 assert.throws(()=>buildCrossTaxaReleaseGate(catalog,change({pleco:{...snapshots.pleco,records:snapshots.pleco.records.slice(1)}}),{now}),/Cross-taxa release gate|Pleco backlink review/);
 assert.throws(()=>buildCrossTaxaReleaseGate(catalog,change({cory:{...snapshots.cory,records:snapshots.cory.records.slice(1)}}),{now}),/Cross-taxa release gate|Cory review/);
 assert.throws(()=>buildCrossTaxaReleaseGate(catalog,snapshots,{now:'not a date'}),/Cross-taxa release gate/);
});
test('guarded manifest cannot be marked released by setting flags on external options',()=>{
 const r=buildCrossTaxaReleaseGate(catalog,snapshots,{now,approval:true,allowArchived:true,force:true});
 assert.equal(r.publicationAuthorized,false);
 assert.ok(r.proposals.every(x=>x.approval==='not-granted'));
 assert.equal(r.discordWrites,0);
});
