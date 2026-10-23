/**
 * Source-only readback of the pending cross-taxa review queue.
 * The public Guppy canary is removed ONLY after validating its pinned receipt.
 * No token loading, Discord network calls, writes, approval or post action.
 */
import fs from 'node:fs';
import {stageCrossTaxaPostCanary} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';

const get=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const manifest=get('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const guppyRecords=get('../test/fixtures/guppypedia-source-20261021.json');
const receipt=get('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const pending=stageCrossTaxaPostCanary(manifest,guppyRecords,receipt);
const full=process.argv.slice(2).includes('--queue');
if(process.argv.slice(2).some(a=>a!=='--queue'))
 throw Error('only --queue is supported; no publish or write flags exist');
const entry=x=>({
 id:x.id,
 group:x.group,
 existingThreadId:x.existingThreadId,
 sourceUrls:x.sourceUrls,
 receiptKey:x.receiptKey,
 archived:x.archived,
 evidenceStatus:'PENDING_INDEPENDENT_SOURCE_AND_MEDIA_RIGHTS_REVIEW',
 publicationAuthorized:false
});
const result={
 schema:pending.schema,
 historicalRecordedMessageUrl:pending.completedMessageUrl,
 historicalReceiptNeedsFreshReadback:pending.completedRequiresFreshLiveReadback,
 completedProposalExcluded:pending.completedProposalId,
 pendingCount:pending.pendingCount,
 activeCount:pending.activeProposalCount,
 archivedHoldCount:pending.archivedHeld,
 byGroup:pending.byGroup,
 batches:pending.batches.map(b=>({
  batch:b.index,count:b.items.length,
  ids:b.items.map(x=>x.id),
  ...(full?{items:b.items.map(entry)}:{})
 })),
 archived:full?pending.archived.map(entry):{held:pending.archivedHeld},
 publicationAuthorized:false,
 discordWrites:0,
 requiresFreshLivePreflight:true,
 requiresIndependentSourceReview:true,
 requiresSignedOneWriterRelease:true
};
console.log(JSON.stringify(result,null,2));
