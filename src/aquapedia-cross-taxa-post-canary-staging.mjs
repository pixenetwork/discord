/**
 * Review-only POST-CANARY active staging. Uses existing immutable 99-item
 * release plan and the authenticated historical Guppy receipt cross-check.
 * It can neither post nor authorize. A fresh live readback is mandatory
 * before any separately governed publication.
 */
import {stageCrossTaxaActiveBatch} from './aquapedia-cross-taxa-active-staging.mjs';
import {reconcileSourceOnlyCanary} from './aquapedia-cross-taxa-canary-reconciliation.mjs';

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
