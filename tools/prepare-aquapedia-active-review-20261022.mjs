/**
 * PLAN ONLY. Does not contain credentials, create write clients, or
 * authorize source publication. All article statuses remain unreviewed.
 */
import fs from 'node:fs';
import {stageCrossTaxaActiveBatch} from '../src/aquapedia-cross-taxa-active-staging.mjs';
const manifest=JSON.parse(fs.readFileSync('resources/aquapedia-cross-taxa-release-review-20261021.json','utf8'));
const res=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
if(!res.ok)throw Error('Public source HTTP '+res.status);
const live=await res.json();
const counts=Object.fromEntries(['guppy','corydoras','pleco'].map(group=>[group,live.filter(x=>x.group===group).length]));
if(live.length<853||counts.guppy!==176||counts.corydoras!==19||counts.pleco!==167)
 throw Error('Live source cohort changed since frozen review');
const active=stageCrossTaxaActiveBatch(manifest);
const minimal=x=>({id:x.id,group:x.group,threadId:x.existingThreadId,
 sourceUrls:x.sourceUrls,contentSha256:x.sha256,receiptKey:x.receiptKey,
 archived:x.archived,editorialStatus:'needs independent review'});
const record={
 createdAt:new Date().toISOString(),sourceCatalogTotal:live.length,sourceCohorts:counts,
 purpose:'Unapproved active-only review staging. DO NOT POST.',
 publicationAuthorized:false,discordWrites:0,newThreadsToCreate:0,
 activeCount:active.activeProposalCount,archivedHeld:active.archivedHeld,
 byGroup:active.byGroup,
 batches:active.batches.map(b=>({
  index:b.index,canPublish:false,needsLivePreflight:true,
  requiresOwnerApproval:true,sourceReviewRequired:true,
  items:b.items.map(minimal)
 })),
 archived:active.archived.map(minimal)
};
const path='resources/aquapedia-cross-taxa-active-review-20261022.json';
if(fs.existsSync(path))throw Error('Existing stage file, refuse overwrite');
fs.writeFileSync(path,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
const doc=[
 '# Aquapedia active-thread-only cross-taxa release preparation (not published)',
 '',
 '> **REVIEW REQUIRED**. These records are not scientifically cleared or authorized to post. The original canonical bot is unchanged.',
 '',
 '- Live catalog records checked: '+live.length+'; frozen review source totals '+Object.entries(counts).map(([k,v])=>k+' '+v).join(', ')+'.',
 '- Existing approved-scope publisher remains separate; this plan has no --apply or Discord write action.',
 '- Active existing-thread proposals staged: **'+active.activeProposalCount+'**: '+Object.entries(active.byGroup).map(([k,v])=>k+' '+v).join(', ')+'.',
 '- Archived original-thread proposals held untouched: **'+active.archivedHeld+'** (6 Cory, 30 Pleco). No auto-unarchive or new threads.',
 '- Batch safety cap **12 proposed messages**; six review batches with '+active.batches.map(x=>x.items.length).join(', ')+'.',
 '- Every candidate is pending editorial/source review, current bot owner confirmation, fresh source and duplicate preflight, single exclusive writer lock, owner approval, message readback and durable receipt.',
 '- An outdated cached snapshot is NOT a publication receipt. All candidates default `canPublish:false` and `publicationAuthorized:false`.',
 '',
 '## Review batches (all unapproved)',
 '',
 ...active.batches.map(x=>'- Batch '+x.index+': '+x.items.length+' updates; breakdown '+Object.entries(Object.groupBy(x.items,p=>p.group)).map(([g,a])=>g+' '+a.length).join(', ')),
 '',
 'Original thread IDs and receipt keys, without reusable bot credentials: `resources/aquapedia-cross-taxa-active-review-20261022.json`.',
 ''
];
const md='docs/operations/aquapedia-cross-taxa-active-review-20261022.md';
if(fs.existsSync(md))throw Error('Existing active-review document');
fs.writeFileSync(md,doc.join('\n')+'\n',{flag:'wx'});
console.log('ACTIVE_CROSS_TAXA_REVIEW '+JSON.stringify({sourceCatalog:live.length,active:active.activeProposalCount,archived:active.archivedHeld,batches:active.batches.map(x=>x.items.length),byGroup:active.byGroup,canPublish:false,discordWrites:0}));
