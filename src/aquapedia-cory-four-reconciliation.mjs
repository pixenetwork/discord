import {createHash} from 'node:crypto';
import {buildCorySourceOnlyBacklink} from './aquapedia-cory-source-only-backlink.mjs';
const deny=s=>{throw Error('Cory source-only receipt reconciliation: '+s)};
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
export function reconcileFourCorySourceLinks(coryCatalog,receiptBatch,guppyLedger,historicalManifest){
 if(!Array.isArray(coryCatalog)||coryCatalog.length!==19||
  receiptBatch?.liveVerified!==true||!Array.isArray(receiptBatch.topics)||receiptBatch.topics.length!==4||
  !guppyLedger||guppyLedger.verifiedGuppyIndexMessages!==4||guppyLedger.pendingCrossTaxaProposals!==95||
  !historicalManifest||historicalManifest.publicationAuthorized!==false||
  historicalManifest.proposals?.length!==99)
  deny('untrusted release baseline or receipt set');
 const order=['burgessi','davidsandsi','nattereri','xinguense'];
 const seen=new Set(),completed=[];
 for(let i=0;i<order.length;i++){
  const key=order[i],r=receiptBatch.topics[i];
  const plan=buildCorySourceOnlyBacklink(coryCatalog,key);
  if(!r||r.key!==key||r.verified!==true||
   r.threadId!==plan.threadId||r.sourceUrl!==plan.pageUrl||
   r.messageSha256!==sha(plan.content)||
   !/^\d{17,20}$/.test(r.botAuthorId||'')||
   !/^\d{17,20}$/.test(r.messageId||'')||
   seen.has(r.messageId)||
   r.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+r.messageId)
    deny('source or bot receipt mismatch '+key);
  seen.add(r.messageId);
  const proposal=historicalManifest.proposals.find(p=>p.id==='corydoras:research-section-backlink:'+plan.slug);
  if(!proposal||proposal.archived||proposal.existingThreadId!==plan.threadId||
      proposal.sourceUrls?.join('|')!==plan.pageUrl)
   deny('original review mapping no longer matches '+key);
  completed.push({key,threadId:r.threadId,messageId:r.messageId,url:r.url,sourceUrl:r.sourceUrl});
 }
 const remaining=historicalManifest.proposals.filter(p=>p.group==='pleco'||
  (p.group==='corydoras'&&!completed.some(c=>p.id.endsWith(c.key+'-breeding'))));
 if(remaining.length!==91||remaining.filter(p=>!p.archived).length!==55||
    remaining.filter(p=>p.archived).length!==36)
  deny('source-only remaining research workload changed');
 return {
  guppyStandardIndexLinks:48,corySourceLinksVerified:4,
  coryPublished:completed,
  pendingCrossTaxaProposals:91,pendingActive:55,pendingArchived:36,
  pendingByGroup:{corydoras:6,pleco:85},
  claimLevelVerificationGranted:false,mediaRightsGranted:false,otherPublicationsAuthorized:false,
  discordWritesInReconciliation:0
 };
}
