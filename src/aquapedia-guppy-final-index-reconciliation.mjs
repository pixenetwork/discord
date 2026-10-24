/**
 * Verified one-time public Guppy index receipts reconciled with held draft PR.
 * Not a publisher: no Discord client, no auth, no write side effects.
 */
import {createHash} from 'node:crypto';
import {buildRemainingGuppyIndex} from './aquapedia-guppy-remaining-index.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const deny=why=>{throw Error('Guppy final source-index reconciliation: '+why)};
export function reconcileAllGuppyShowIndexes(catalog,baseReceipt,remainingReceipt,reviewManifest){
 if(!Array.isArray(catalog)||catalog.length!==176||
    !baseReceipt||baseReceipt.verified!==true||baseReceipt.sourceEntryCount!==10||
    baseReceipt.messageId!=='1562987115036278834'||
    !remainingReceipt||!Array.isArray(remainingReceipt.topics)||remainingReceipt.topics.length!==3||
    !reviewManifest||reviewManifest.publicationAuthorized!==false||
    !Array.isArray(reviewManifest.proposals)||reviewManifest.proposals.length!==99)
   deny('source or original manifest not authentic');
 const order=['cover-one','cover-two','tail'];
 const seenUrls=new Set(),seenMessages=new Set([baseReceipt.messageId]);
 const receipts=[];
 for(let i=0;i<order.length;i++){
  const key=order[i],receipt=remainingReceipt.topics[i];
  const plan=buildRemainingGuppyIndex(catalog,key);
  if(!receipt||receipt.topic!==key||receipt.verified!==true||
    receipt.threadId!==plan.threadId||receipt.messageSha256!==sha(plan.content)||
    receipt.sourceEntryCount!==plan.entryUrls.length||
    receipt.sourceUrls?.join('|')!==plan.entryUrls.join('|')||
    !/^\d{17,20}$/.test(receipt.messageId||'')||
    !/^\d{17,20}$/.test(receipt.botAuthorId||'')||
    !/^2026-\d{2}-\d{2}T/.test(receipt.verifiedAt||'')||
    seenMessages.has(receipt.messageId)||
    receipt.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+receipt.messageId)
   deny('source-bound Discord receipt mismatch '+key);
  seenMessages.add(receipt.messageId);
  for(const url of plan.entryUrls){
   if(seenUrls.has(url))deny('same source entry in two messages');
   seenUrls.add(url);
  }
  receipts.push({topic:key,messageId:receipt.messageId,url:receipt.url,sourceCount:plan.entryUrls.length});
 }
 if(seenUrls.size!==38)deny('incomplete Guppy indices');
 const guppyProposals=reviewManifest.proposals.filter(p=>p.group==='guppy');
 if(guppyProposals.length!==4)deny('original review manifest missing Guppy scope');
 const sourceIds=new Set([...Array(10)].map((_,i)=>'gup-'+String(i+1).padStart(3,'0')));
 for(const u of seenUrls)sourceIds.add(u.match(/gup-(\d{3})\/$/)?.[0]?.slice(0,7)??'');
 if(sourceIds.size!==48)deny('full Guppy standard not covered');
 const pending=reviewManifest.proposals.filter(p=>p.group!=='guppy');
 const active=pending.filter(p=>!p.archived);
 if(pending.length!==95||active.length!==59||pending.filter(p=>p.archived).length!==36)deny('unexpected remaining scope');
 return {
  verifiedGuppyIndexMessages:4,verifiedGuppySourceUrls:48,
  completedNewMessageReceipts:receipts,
  heldGuppyCommercialAndHybridLabels:128,
  pendingCrossTaxaProposals:95,pendingActive:59,pendingArchived:36,
  pendingByGroup:{corydoras:10,pleco:85},
  remainingPublicationsAuthorized:false,discordWritesInReconciliation:0
 };
}
