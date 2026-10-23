/**
 * Authoritative READ-ONLY release queue. Historical review proposals stay
 * immutable. Guppy FOUR, Cory FOUR, Pleco FIVE and taxonomy SEVEN receipts
 * must verify before any previously published source link is excluded.
 */
import fs from 'node:fs';
import {stageCrossTaxaAfterAllGuppyIndexes} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';
import {reconcileFourCorySourceLinks} from '../src/aquapedia-cory-four-reconciliation.mjs';
import {reconcileFivePlecoSourcePosts} from '../src/aquapedia-pleco-five-reconciliation.mjs';
import {reconcileSevenPlecoTaxonomySources} from '../src/aquapedia-pleco-seven-taxonomy-reconciliation.mjs';
const file=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>x!=='--queue'))throw Error('Only optional --queue supported; no apply or write');
const detailed=args.includes('--queue');
const manifest=file('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const guppySource=file('../test/fixtures/guppypedia-source-20261021.json');
const corySource=file('../test/fixtures/corydoraspedia-thread-review-20261021.json').records.map(x=>({...x,group:'corydoras'}));
const plecoSource=file('../test/fixtures/plecopedia-public-source-20261021.json');
const base=file('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const later=file('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const guppyLedger=file('../resources/aquapedia-guppy-all-48-live-release-20261022.json');
const coryReceipts=file('../resources/aquapedia-cory-four-live-receipts-20261022.json');
const fiveReceipts=file('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const sevenReceipts=file('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
const plecoEditorial=file('../resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
const afterGuppy=stageCrossTaxaAfterAllGuppyIndexes(manifest,guppySource,base,later);
const cory=reconcileFourCorySourceLinks(corySource,coryReceipts,guppyLedger,manifest);
const plecoFive=reconcileFivePlecoSourcePosts(plecoSource,fiveReceipts,plecoEditorial,manifest);
const plecoSeven=reconcileSevenPlecoTaxonomySources(plecoSource,sevenReceipts,manifest,fiveReceipts);
const released=new Set([
 ...cory.coryPublished.map(x=>'corydoras:research-section-backlink:hoplisoma-'+x.key+'-breeding'),
 ...plecoFive.releasedProposalIds,
 ...plecoSeven.completedProposalIds
]);
if(released.size!==16)throw Error('Expected sixteen unique manually receipt-verified source links');
const active=afterGuppy.batches.flatMap(b=>b.items).filter(x=>!released.has(x.id));
const archived=afterGuppy.archived;
if(active.length!==43||archived.length!==36||active.some(x=>x.group!=='pleco')||
   cory.pendingCrossTaxaProposals!==91||plecoFive.remainingProposals!==86||plecoSeven.remaining!==79)
 throw Error('Current queue differs from verified receipts; refuse replay');
const receiptKeys=new Set([...active,...archived].map(x=>x.receiptKey));
if(receiptKeys.size!==79)throw Error('Duplicate pending receipt identity');
const view=item=>({id:item.id,group:item.group,existingThreadId:item.existingThreadId,
 sourceUrls:item.sourceUrls,receiptKey:item.receiptKey,archived:item.archived,
 reviewRequired:true,publicationAuthorized:false});
const batches=[];
for(let i=0;i<active.length;i+=12){
 const items=active.slice(i,i+12);
 batches.push({index:batches.length+1,count:items.length,canPublish:false,
  ...(detailed?{items:items.map(view)}:{ids:items.map(x=>x.id)})});
}
console.log(JSON.stringify({
 schema:'aquapedia.cross-taxa.post-seven-pleco-taxonomy-reviewed.v1',
 verifiedGuppySourceLinks:cory.guppyStandardIndexLinks,
 verifiedCoryWorkingReportLinks:cory.corySourceLinksVerified,
 verifiedPlecoResearchSourceLinks:plecoFive.verifiedPlecoResearchLinks+plecoSeven.verifiedPlecoTaxonomyPosts,
 historicalReviewItems:99,
 pendingCount:79,activeCount:43,archivedHeld:36,
 byGroup:{corydoras:6,pleco:73},
 activeByGroup:{corydoras:0,pleco:43},
 activeBatches:batches,
 archived:detailed?archived.map(view):{held:archived.length},
 noPublishAccess:true,publicationAuthorized:false,discordWrites:0,
 requiresFreshLiveReadback:true,
 warning:'Receipt-only source-link reconciliation; no scientific claim approval, archived release or blanket publication'
},null,2));
