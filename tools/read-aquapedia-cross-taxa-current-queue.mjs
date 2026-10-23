/**
 * CURRENT source-only research review queue, after verified Guppy FOUR
 * and Cory FOUR public source-link receipts. This script is read-only.
 * Frozen 99-proposal manifest and historic 95-item Guppy-only stage remain
 * untouched. No bot credentials, network or filesystem writes.
 */
import fs from 'node:fs';
import {stageCrossTaxaAfterAllGuppyIndexes} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';
import {reconcileFourCorySourceLinks} from '../src/aquapedia-cory-four-reconciliation.mjs';
const file=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>x!=='--queue'))throw Error('Only optional --queue supported; no apply or write');
const detailed=args.includes('--queue');
const manifest=file('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const guppySource=file('../test/fixtures/guppypedia-source-20261021.json');
const corySource=file('../test/fixtures/corydoraspedia-thread-review-20261021.json').records.map(x=>({...x,group:'corydoras'}));
const base=file('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const later=file('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const guppyLedger=file('../resources/aquapedia-guppy-all-48-live-release-20261022.json');
const coryReceipts=file('../resources/aquapedia-cory-four-live-receipts-20261022.json');
const afterGuppy=stageCrossTaxaAfterAllGuppyIndexes(manifest,guppySource,base,later);
const updated=reconcileFourCorySourceLinks(corySource,coryReceipts,guppyLedger,manifest);
const released=new Set(updated.coryPublished.map(x=>'corydoras:research-section-backlink:hoplisoma-'+x.key+'-breeding'));
const active=afterGuppy.batches.flatMap(b=>b.items).filter(x=>!released.has(x.id));
const archived=afterGuppy.archived;
if(active.length!==55||archived.length!==36||active.some(x=>x.group!=='pleco')||
   updated.pendingCrossTaxaProposals!==91)
 throw Error('Current queue mismatch; do not accidentally replay a published Cory source link');
const receipts=new Set([...active,...archived].map(x=>x.receiptKey));
if(receipts.size!==91)throw Error('Duplicate release receipt in pending research queue');
const show=item=>({
 id:item.id,group:item.group,existingThreadId:item.existingThreadId,
 sourceUrls:item.sourceUrls,receiptKey:item.receiptKey,
 archived:item.archived,reviewRequired:true,publicationAuthorized:false
});
const batches=[];
for(let i=0;i<active.length;i+=12){
 const items=active.slice(i,i+12);
 batches.push({index:batches.length+1,count:items.length,canPublish:false,
  ...(detailed?{items:items.map(show)}:{ids:items.map(x=>x.id)})});
}
console.log(JSON.stringify({
 schema:'aquapedia.cross-taxa.current-post-cory-reviewed.v1',
 verifiedGuppySourceLinks:updated.guppyStandardIndexLinks,
 verifiedCoryWorkingReportLinks:updated.corySourceLinksVerified,
 historicalReviewItems:99,
 pendingCount:91,activeCount:55,archivedHeld:36,
 byGroup:{corydoras:6,pleco:85},
 activeByGroup:{corydoras:0,pleco:55},
 activeBatches:batches,
 archived:detailed?archived.map(show):{held:archived.length},
 noPublishAccess:true,publicationAuthorized:false,discordWrites:0,
 requiresFreshLiveReadback:true,
 warning:'Read-only historical receipt reconciliation, not an editorial approval or a release command'
},null,2));
