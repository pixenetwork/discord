/**
 * Reconcile the one already verified source-only Guppy index with PR #60's
 * frozen 99-proposal REVIEW manifest. Does not publish or alter a receipt.
 */
import {createHash} from 'node:crypto';
import {buildGuppyBaseIndexCanary} from './aquapedia-guppy-base-index-canary.mjs';
const reject=why=>{throw Error('Cross-taxa receipt reconciliation: '+why)};
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const completeId='guppy:show-phenotype-index:index-base-1';

export function reconcileSourceOnlyCanary(manifest,guppyCatalog,receipt){
 if(!manifest||manifest.publicationAuthorized!==false||!Array.isArray(manifest.proposals)||manifest.proposals.length!==99)
  reject('unexpected release manifest');
 if(!receipt||receipt.verified!==true||receipt.version!==1||
  receipt.sourceEntryCount!==10||receipt.sourceEntryIds?.length!==10||
  !/^\d{17,20}$/.test(receipt.botAuthorId||'')||
  !/^\d{17,20}$/.test(receipt.messageId||'')||
  !/^2026-\d{2}-\d{2}T/.test(receipt.verifiedAt||'')||
  receipt.actionVerified!=='posted-and-rechecked-as-adopted'||
  receipt.otherCrossTaxaProposalsPublished!==false||receipt.noPicturesOrMedia!==true)
  reject('receipt does not demonstrate verified source-only publication');
 const plan=buildGuppyBaseIndexCanary(guppyCatalog);
 if(receipt.threadId!==plan.threadId||
  receipt.messageSha256!==digest(plan.content)||
  receipt.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+receipt.messageId||
  receipt.sourceEntryIds.join('|')!==plan.recordIds.join('|'))
  reject('source index proof or target does not match the authenticated canary');
 const target=manifest.proposals.find(p=>p.id===completeId);
 if(!target||target.group!=='guppy'||target.existingThreadId!==plan.threadId||
  target.sourceUrls.join('|')!==plan.recordIds.map(id=>'https://aquapedia.app/guppypedia/entries/'+id+'/').join('|'))
  reject('original review proposal does not match the ten posted source links');
 const remaining=manifest.proposals.filter(x=>x.id!==completeId);
 if(remaining.length!==98)reject('unexpected remaining proposal count');
 const active=remaining.filter(x=>!x.archived),archived=remaining.filter(x=>x.archived);
 if(active.length!==62||archived.length!==36)reject('remaining archived/active counts changed');
 return {
  verifiedPostedSourceOnlyMessages:1,
  verifiedPublishedSourceEntries:10,
  completedProposalId:completeId,
  completedDiscordMessageUrl:receipt.url,
  remainingProposals:98,remainingActive:62,remainingArchived:36,
  remainingByGroup:{guppy:remaining.filter(x=>x.group==='guppy').length,
   corydoras:remaining.filter(x=>x.group==='corydoras').length,
   pleco:remaining.filter(x=>x.group==='pleco').length},
  overallCrossTaxaReleaseAuthorized:false,
  discordWritesDuringReconciliation:0
 };
}
