/**
 * Canonical READ-ONLY Aquapedia cross-taxa backlog.
 * Four Guppy indexes, four Cory references and seventeen Pleco source-only
 * posts are counted ONLY after their individually authenticated receipts.
 * Frozen 99-proposal review inventory remains immutable.
 */
import fs from 'node:fs';
import {stageCrossTaxaAfterAllGuppyIndexes} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';
import {reconcileFourCorySourceLinks} from '../src/aquapedia-cory-four-reconciliation.mjs';
import {reconcileFivePlecoSourcePosts} from '../src/aquapedia-pleco-five-reconciliation.mjs';
import {reconcileSevenPlecoTaxonomySources} from '../src/aquapedia-pleco-seven-taxonomy-reconciliation.mjs';
import {reconcileThreeDirectPlecoDescriptions} from '../src/aquapedia-pleco-three-direct-reconciliation.mjs';
import {reconcileTwoPlecoNames} from '../src/aquapedia-pleco-two-nomenclature-reconciliation.mjs';
const read=x=>JSON.parse(fs.readFileSync(new URL(x,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>x!=='--queue'))throw Error('Only optional --queue supported; no apply or write');
const detailed=args.includes('--queue');
const manifest=read('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const guppySource=read('../test/fixtures/guppypedia-source-20261021.json');
const corySource=read('../test/fixtures/corydoraspedia-thread-review-20261021.json').records.map(x=>({...x,group:'corydoras'}));
const plecoSource=read('../test/fixtures/plecopedia-public-source-20261021.json');
const base=read('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const later=read('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const guppyLedger=read('../resources/aquapedia-guppy-all-48-live-release-20261022.json');
const coryReceipts=read('../resources/aquapedia-cory-four-live-receipts-20261022.json');
const fiveReceipts=read('../resources/aquapedia-pleco-five-live-receipts-20261023.json');
const sevenReceipts=read('../resources/aquapedia-pleco-seven-taxonomy-live-receipts-20261023.json');
const threeReceipts=read('../resources/aquapedia-pleco-three-direct-live-receipts-20261023.json');
const twoReceipts=read('../resources/aquapedia-pleco-two-nomenclature-live-receipts-20261023.json');
const plecoEditorial=read('../resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
const afterGuppy=stageCrossTaxaAfterAllGuppyIndexes(manifest,guppySource,base,later);
const cory=reconcileFourCorySourceLinks(corySource,coryReceipts,guppyLedger,manifest);
const five=reconcileFivePlecoSourcePosts(plecoSource,fiveReceipts,plecoEditorial,manifest);
const seven=reconcileSevenPlecoTaxonomySources(plecoSource,sevenReceipts,manifest,fiveReceipts);
const three=reconcileThreeDirectPlecoDescriptions(plecoSource,threeReceipts,manifest,fiveReceipts,sevenReceipts);
const two=reconcileTwoPlecoNames(plecoSource,twoReceipts,manifest,fiveReceipts,sevenReceipts,threeReceipts);
const released=new Set([
 ...cory.coryPublished.map(x=>'corydoras:research-section-backlink:hoplisoma-'+x.key+'-breeding'),
 ...five.releasedProposalIds,
 ...seven.completedProposalIds,
 ...three.completedIds,
 ...two.completedIds
]);
if(released.size!==21)throw Error('Exactly twenty-one non-Guppy source-link receipts required');
const active=afterGuppy.batches.flatMap(b=>b.items).filter(x=>!released.has(x.id));
const archived=afterGuppy.archived;
if(active.length!==38||archived.length!==36||active.some(x=>x.group!=='pleco')||
 cory.pendingCrossTaxaProposals!==91||five.remainingProposals!==86||
 seven.remaining!==79||three.pendingCount!==76||two.pendingCount!==74)
 throw Error('Current queue mismatches frozen proposals and verified receipts');
if(new Set([...active,...archived].map(x=>x.receiptKey)).size!==74)
 throw Error('Duplicate pending publication receipt identity');
const view=x=>({
 id:x.id,group:x.group,existingThreadId:x.existingThreadId,sourceUrls:x.sourceUrls,
 receiptKey:x.receiptKey,archived:x.archived,reviewRequired:true,publicationAuthorized:false
});
const batches=[];
for(let i=0;i<active.length;i+=12){
 const items=active.slice(i,i+12);
 batches.push({index:batches.length+1,count:items.length,canPublish:false,
  ...(detailed?{items:items.map(view)}:{ids:items.map(x=>x.id)})});
}
console.log(JSON.stringify({
 schema:'aquapedia.cross-taxa.post-two-pleco-nomenclature-reviewed.v1',
 verifiedGuppySourceLinks:cory.guppyStandardIndexLinks,
 verifiedCoryWorkingReportLinks:cory.corySourceLinksVerified,
 verifiedPlecoResearchSourceLinks:
  five.verifiedPlecoResearchLinks+seven.verifiedPlecoTaxonomyPosts+
  three.verifiedDirectDescriptionMessages+two.verifiedNomenclatureMessages,
 historicalReviewItems:99,
 pendingCount:74,activeCount:38,archivedHeld:36,
 byGroup:{corydoras:6,pleco:68},
 activeByGroup:{corydoras:0,pleco:38},
 activeBatches:batches,
 archived:detailed?archived.map(view):{held:archived.length},
 noPublishAccess:true,publicationAuthorized:false,discordWrites:0,
 requiresFreshLiveReadback:true,
 warning:'Receipt-only source directory accounting; no pedigree, rights clearance, automatic or archived publication'
},null,2));
