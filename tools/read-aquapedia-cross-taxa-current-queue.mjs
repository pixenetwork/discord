/**
 * Current review-only status from FOUR historic Guppy receipts. No Discord
 * connection, token, filesystem mutation, scheduler, --apply or publish.
 */
import fs from 'node:fs';
import {stageCrossTaxaAfterAllGuppyIndexes} from '../src/aquapedia-cross-taxa-post-canary-staging.mjs';
const file=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const manifest=file('../resources/aquapedia-cross-taxa-release-review-20261021.json');
const source=file('../test/fixtures/guppypedia-source-20261021.json');
const first=file('../resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const later=file('../resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const queue=stageCrossTaxaAfterAllGuppyIndexes(manifest,source,first,later);
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--queue')||args.length>1)
 throw Error('read-only: only optional --queue supported');
const detailed=args.includes('--queue');
const fields=item=>({
 id:item.id,group:item.group,existingThreadId:item.existingThreadId,
 sourceUrls:item.sourceUrls,receiptKey:item.receiptKey,
 archived:item.archived,reviewRequired:true,publicationAuthorized:false
});
console.log(JSON.stringify({
 schema:queue.schema,
 postedGuppyIndexMessagesInHistoricReceipts:queue.guppyIndexMessagesVerifiedByStoredReceipts,
 completedGuppyShowSourceLinks:queue.guppyShowStandardSourceEntries,
 unverifiedGuppyTradeLabelsHeld:queue.heldUnverifiedGuppyTradeLabels,
 pendingCount:queue.pendingCount,activeCount:queue.activeCount,
 archivedHeld:queue.archivedHeld,byGroup:queue.byGroup,activeByGroup:queue.activeByGroup,
 activeBatches:queue.batches.map(b=>({
  number:b.index,count:b.items.length,
  ...(detailed?{items:b.items.map(fields)}:{ids:b.items.map(item=>item.id)})
 })),
 archived:detailed?queue.archived.map(fields):{held:queue.archivedHeld},
 noPublishAccess:true,publicationAuthorized:false,discordWrites:0,
 requiresFreshLiveReadback:true
},null,2));
