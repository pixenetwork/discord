/**
 * Produce a reproducible public-source review manifest.
 * NO Discord client, NO dispatch, NO editorial approval implied.
 */
import fs from 'node:fs';
import {buildCrossTaxaReleaseGate} from '../src/aquapedia-cross-taxa-release-gate.mjs';
const fixture=name=>JSON.parse(fs.readFileSync('test/fixtures/'+name,'utf8'));
const snapshot={
 guppy:fixture('guppypedia-forum-starters-20261021.json'),
 cory:fixture('corydoraspedia-thread-review-20261021.json'),
 pleco:fixture('plecopedia-thread-parity-20261021.json')
};
const fixtures={
 guppy:fixture('guppypedia-source-20261021.json'),
 pleco:fixture('plecopedia-public-source-20261021.json')
};
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
if(!response.ok)throw Error('Live catalog HTTP '+response.status);
const all=await response.json();
const cohort=all.filter(x=>['guppy','pleco','corydoras'].includes(x.group));
if(all.length<853||cohort.length!==362)throw Error('Catalog changed unexpectedly');
const normalize=r=>({name:r.name,slug:r.slug,url:r.url,group:r.group,type:r.type,status:r.status});
for(const key of ['guppy','pleco']){
 const a=cohort.filter(x=>x.group===key).map(normalize);
 const b=fixtures[key];
 const sorted=rows=>rows.toSorted((x,y)=>x.url.localeCompare(y.url));
 if(JSON.stringify(sorted(a))!==JSON.stringify(sorted(b)))
  throw Error('Source identity/status drift in '+key);
}
const cory=cohort.filter(x=>x.group==='corydoras');
const coryFromSnapshot=snapshot.cory.records.map(({name,slug,url,type,status})=>({name,slug,url,type,status,group:'corydoras'}));
if(JSON.stringify(cory.map(normalize).toSorted((x,y)=>x.url.localeCompare(y.url)))!==
 JSON.stringify(coryFromSnapshot.map(normalize).toSorted((x,y)=>x.url.localeCompare(y.url))))
 throw Error('Cory source drift');
const auditTime=new Date().toISOString();
const matrix=buildCrossTaxaReleaseGate(cohort,snapshot,{now:auditTime});
if(matrix.counts.proposedMessages!==99 || matrix.counts.archivedTargets!==36||
 matrix.publicationAuthorized||matrix.discordWrites||matrix.newThreadsToCreate)
 throw Error('Unexpected release gate output');
const artifact={
 title:'Aquapedia 3 taxa release REVIEW ONLY — NOT POSTED',
 sourceCatalogUrl:'https://aquapedia.app/assets/catalog.json',
 sourceCatalogRecords:all.length,
 auditTime,
 codeControl:'Draft PR #60: review only, never an authenticated release receipt',
 ...matrix
};
const output='resources/aquapedia-cross-taxa-release-review-20261021.json';
if(fs.existsSync(output))throw Error('Review output already exists; manual version bump required');
fs.mkdirSync('resources',{recursive:true});
fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n',{encoding:'utf8',flag:'wx'});
const counts=matrix.counts;
const report=[
 '# Aquapedia cross-taxa release matrix — NOT POSTED',
 '',
 '> Editorial and public-audience approval NOT obtained. Snapshot proof is read-only historical evidence; the application has no Discord write logic.',
 '',
 '- Catalog checked live: **'+all.length+'** records. Three excluded cohorts: 362 (176 Guppy, 167 Pleco, 19 Corydoras).',
 '- Read-only proposed message/entry count: **'+counts.proposedMessages+'** (Guppy index '+counts.guppy+', Cory source links '+counts.corydoras+', Pleco source links '+counts.pleco+').',
 '- Destination states from captured Discord snapshot: '+counts.activeTargets+' active targets, **'+counts.archivedTargets+' archived targets**.',
 '- Not duplicated: **'+counts.plecoAlreadyLinked+' Pleco existing article backlinks**.',
 '- Not included: **'+counts.guppyTradeHeld+' Guppy trade/hybrid labels**, '+counts.coryAmbiguousHeld+' Cory ambiguous morph/species targets, '+counts.coryNamingHeld+' Cory taxonomic/lineage holds.',
 '- Every proposal includes existing thread ID, public source URL, deterministic content SHA256, unique receipt identity, no-publication header and approval `not-granted`.',
 '- No public messages, no new threads, no edit/unarchive/permission changes, no active publisher integration, no checkpoint updates.',
 '',
 '## Evidence age — fresh Discord preflight required',
 '',
 '| Cohort | Snapshot age, minutes | Fresh within 60 minutes at audit? |',
 '|---|---:|---|',
 ...Object.entries(matrix.snapshotFreshness).map(([k,v])=>'| '+k+' | '+v.ageMinutes+' | '+(v.fresh?'Yes':'**No — recheck**')+' |'),
 '',
 '**This is not a green-light list.** Even recently sampled states can change. All 99 remain blocked until editorial evidence and permission review, conflict-free source/thread readback and approval-gated one-writer release.',
 '',
 '## Existing research hold queues',
 '',
 '1. Guppy: 48 recognized show-label entries represented in four review-only index drafts; 128 trade/hybrid labels withheld from indexing, pedigree unverified.',
 '2. Cory: ten contextual source links drafted, seven ambiguous morph/species placements, two specific lineage/name issues; six proposed targets are archived.',
 '3. Pleco: 85 missing direct article backlinks after checking 167 existing bot-owned threads, with 30 of the 85 proposed targets archived; 82 already linked, no thread replication.',
 '',
 'Complete proposed content and hashes: `resources/aquapedia-cross-taxa-release-review-20261021.json`.',
 ''
].join('\n');
const reportFile='docs/operations/aquapedia-cross-taxa-release-matrix-20261021.md';
if(fs.existsSync(reportFile))throw Error('Matrix doc already exists; manual version bump required');
fs.writeFileSync(reportFile,report,{encoding:'utf8',flag:'wx'});
console.log('RELEASE_REVIEW_MATRIX: immutable review-only artifacts created');
