/**
 * Pure receipt reconciliation after five individually verified bot-owned
 * Plecopedia research source-only posts. NEVER authorizes the other drafts.
 */
import {createHash} from 'node:crypto';
import {buildPlecoSourceOnlyPilot,PLECO_SOURCE_ONLY_CANDIDATES} from './aquapedia-pleco-source-only-pilot.mjs';
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const refuse=s=>{throw Error('Pleco five receipts: '+s)};
export function reconcileFivePlecoSourcePosts(plecoCatalog,proof,reviewQueue,manifest){
 const keys=Object.keys(PLECO_SOURCE_ONLY_CANDIDATES);
 if(!Array.isArray(plecoCatalog)||plecoCatalog.length!==167||
   proof?.verified!==true||proof.repeatAction!=='adopted'||
   !Array.isArray(proof.records)||proof.records.length!==5||
   !Array.isArray(reviewQueue?.rows)||reviewQueue.rows.length!==55||
   manifest?.publicationAuthorized!==false||manifest.proposals?.length!==99)
   refuse('missing original source or verified receipt evidence');
 const uniqueMessageIds=new Set(),releasedProposals=new Set();
 for(let i=0;i<keys.length;i++){
  const key=keys[i],record=proof.records.find(x=>x.key===key),plan=buildPlecoSourceOnlyPilot(plecoCatalog,key);
  if(!record||record.key!==key||record.verified!==true||
    record.threadId!==plan.threadId||record.sourceUrl!==plan.pageUrl||
    record.doi!==plan.doi||record.contentSha256!==sha(plan.content)||
    !/^\d{17,20}$/.test(record.messageId||'')||
    !/^\d{17,20}$/.test(record.botAuthorId||'')||
    uniqueMessageIds.has(record.messageId)||
    record.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+record.messageId)
    refuse('publication proof mismatch '+key);
  uniqueMessageIds.add(record.messageId);
  const proposalId='pleco:research-article-backlink:'+key;
  const row=reviewQueue.rows.find(x=>x.proposal_id===proposalId);
  const historical=manifest.proposals.find(x=>x.id===proposalId);
  if(!row||row.existing_thread_id!==plan.threadId||row.site_url!==plan.pageUrl||
      !historical||historical.archived!==false||historical.existingThreadId!==plan.threadId||
      historical.sourceUrls.join('|')!==plan.pageUrl)
   refuse('historical thread/source receipt mismatch '+key);
  releasedProposals.add(proposalId);
 }
 if(releasedProposals.size!==5)refuse('duplicate completed proposal keys');
 const remaining=manifest.proposals.filter(x=>x.group!=='guppy'&&
   !(['hoplisoma-burgessi-breeding','hoplisoma-davidsandsi-breeding','hoplisoma-nattereri-breeding','hoplisoma-xinguense-breeding'].some(slug=>x.id==='corydoras:research-section-backlink:'+slug))&&
   !releasedProposals.has(x.id));
 const active=remaining.filter(x=>!x.archived),archived=remaining.filter(x=>x.archived);
 if(remaining.length!==86||active.length!==50||archived.length!==36||
   active.some(x=>x.group!=='pleco'))
   refuse('remaining queue changed; prevent replay');
 return {
  verifiedPlecoSourceOnlyMessages:5,verifiedPlecoResearchLinks:5,
  releasedProposalIds:[...releasedProposals],
  remainingProposals:86,remainingActive:50,remainingArchived:36,
  remainingByGroup:{pleco:80,corydoras:6},
  otherRecordsEditoriallyApproved:false,remainingPublicationAuthorized:false,
  discordWritesInReconciliation:0
 };
}
