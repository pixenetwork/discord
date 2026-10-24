/**
 * Review-only POST-CANARY active staging. Uses existing immutable 99-item
 * release plan and the authenticated historical Guppy receipt cross-check.
 * It can neither post nor authorize. A fresh live readback is mandatory
 * before any separately governed publication.
 */
import {stageCrossTaxaActiveBatch} from './aquapedia-cross-taxa-active-staging.mjs';
import {reconcileSourceOnlyCanary} from './aquapedia-cross-taxa-canary-reconciliation.mjs';
import {reconcileAllGuppyShowIndexes} from './aquapedia-guppy-final-index-reconciliation.mjs';

const stop=why=>{throw Error('Post-canary review: '+why)};
const groupOrder=['guppy','corydoras','pleco'];

export function stageCrossTaxaPostCanary(manifest,guppyCatalog,receipt){
 const frozen=stageCrossTaxaActiveBatch(manifest);
 const historic=reconcileSourceOnlyCanary(manifest,guppyCatalog,receipt);
 const allActive=frozen.batches.flatMap(batch=>batch.items);
 const completed=allActive.filter(p=>p.id===historic.completedProposalId);
 if(completed.length!==1||completed[0].archived||completed[0].group!=='guppy')
  stop('completed canary was not one active Guppy source-only proposal');
 const pending=allActive.filter(p=>p.id!==historic.completedProposalId);
 const held=frozen.archived;
 const byGroup=Object.fromEntries(groupOrder.map(group=>[
  group,pending.filter(p=>p.group===group).length
 ]));
 if(pending.length!==historic.remainingActive||held.length!==historic.remainingArchived||
    pending.length+held.length!==historic.remainingProposals||
    byGroup.guppy!==3||byGroup.corydoras!==4||byGroup.pleco!==55||
    Object.values(byGroup).reduce((a,b)=>a+b,0)!==pending.length)
  stop('historic receipt count or group breakdown mismatch');
 const receiptKeys=new Set([...pending,...held].map(p=>p.receiptKey));
 if(receiptKeys.size!==98||receiptKeys.has(completed[0].receiptKey))
  stop('duplicate, missing or completed proposal receipt in pending queue');
 const cap=12,batches=[];
 for(let offset=0;offset<pending.length;offset+=cap){
  const items=pending.slice(offset,offset+cap);
  batches.push({
   index:batches.length+1,
   items,
   canPublish:false,
   requiresFreshPreflight:true,
   requiresAuthenticatedOwnerApproval:true,
   requiresIndependentSourceReview:true,
   requiresSingleWriterLock:true,
   requiresBotReadback:true,
   requiresDurableReceipt:true
  });
 }
 if(batches.length!==6||batches.at(-1).items.length!==2)
  stop('post-canary 12-item batch cap changed');
 return {
  schema:'aquapedia.cross-taxa.post-canary-review.v1',
  originalProposalCount:99,
  completedProposalId:historic.completedProposalId,
  completedMessageUrl:historic.completedDiscordMessageUrl,
  completedVerifiedHistoricalReceipt:true,
  completedRequiresFreshLiveReadback:true,
  pendingCount:98,
  activeProposalCount:pending.length,
  archivedHeld:held.length,
  byGroup,
  batchSize:cap,
  batches,
  archived:held,
  publicationAuthorized:false,
  canPublish:false,
  discordWrites:0,
  newThreadsToCreate:0,
  nextAction:'fresh Discord/source/permissions readback and independent rights-science review through authorized single writer'
 };
}

/**
 * Reconcile ALL FOUR Guppy receipts already publicly read back by the
 * existing owner bot. Return pending review items only; never post or write.
 * The earlier 98-item single-canary view remains historical.
 */
export function stageCrossTaxaAfterAllGuppyIndexes(manifest,guppyCatalog,baseReceipt,remainingReceipt){
 const first=stageCrossTaxaPostCanary(manifest,guppyCatalog,baseReceipt);
 const complete=reconcileAllGuppyShowIndexes(guppyCatalog,baseReceipt,remainingReceipt,manifest);
 const original=manifest.proposals.filter(p=>p.group==='guppy');
 const later=original.filter(p=>p.id!==first.completedProposalId);
 const topics=remainingReceipt.topics;
 if(original.length!==4||later.length!==3||topics.length!==3)
  stop('unexpected number of previously reported Guppy index entries');
 // Match each previously planned source list and parent forum to the actual
 // immutable message receipts, not merely to an asserted release count.
 for(let i=0;i<topics.length;i++){
  const p=later[i],r=topics[i];
  if(p.existingThreadId!==r.threadId||
     p.sourceUrls.join('|')!==r.sourceUrls.join('|')||
     !p.id.startsWith('guppy:show-phenotype-index:'))
   stop('published Guppy receipt does not correspond to a frozen proposal');
 }
 const active=first.batches.flatMap(b=>b.items).filter(p=>p.group!=='guppy');
 const held=first.archived;
 if(complete.pendingCrossTaxaProposals!==95||complete.pendingActive!==59||
    complete.pendingArchived!==36||active.length!==59||held.length!==36||
    active.some(p=>p.group==='guppy')||held.some(p=>p.group==='guppy')||
    active.filter(p=>p.group==='corydoras').length!==4||
    active.filter(p=>p.group==='pleco').length!==55)
  stop('Guppy publication ledger or remaining cohort count drift');
 const receipts=new Set([...active,...held].map(p=>p.receiptKey));
 if(receipts.size!==95)stop('duplicate pending receipt keys');
 const batches=[];
 for(let offset=0;offset<active.length;offset+=12){
  batches.push({
   index:batches.length+1,items:active.slice(offset,offset+12),
   canPublish:false,requiresFreshPreflight:true,
   requiresAuthenticatedOwnerApproval:true,requiresIndependentSourceReview:true,
   requiresSingleWriterLock:true,requiresBotReadback:true,requiresDurableReceipt:true
  });
 }
 if(batches.length!==5||batches.at(-1).items.length!==11)
  stop('pending batching no longer matches fixed 12-item cap');
 return {
  schema:'aquapedia.cross-taxa.all-guppy-indexes-review.v1',
  historicProposals:99,
  guppyIndexMessagesVerifiedByStoredReceipts:4,
  guppyShowStandardSourceEntries:48,
  heldUnverifiedGuppyTradeLabels:128,
  pendingCount:95,activeCount:59,archivedHeld:36,
  byGroup:{guppy:0,corydoras:10,pleco:85},
  activeByGroup:{guppy:0,corydoras:4,pleco:55},
  batches,archived:held,
  publicationAuthorized:false,canPublish:false,discordWrites:0,
  newThreadsToCreate:0,requiresFreshLiveReadback:true,
  warning:'Stored receipts are historical proof, not a fresh source or posting authorization.'
 };
}
