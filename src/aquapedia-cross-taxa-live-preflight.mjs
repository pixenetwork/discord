/**
 * Read-only preflight of known existing Discord threads.
 * Inject only readThread/readMessages API adapters; the function cannot post,
 * unarchive, edit, or change permissions. No action approvals are implemented.
 */
import {createHash} from 'node:crypto';
const forums={
 guppy:'1562195139353645146',
 pleco:'1560931428680601630',
 corydoras:'1560887812910350339'
};
const reject=reason=>{throw Error('Live preflight: '+reason)};
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');

export async function auditCrossTaxaLiveTargets(manifest,{botUserId,observedAt,readThread,readMessages}={}){
 if(!manifest||manifest.publicationAuthorized!==false||manifest.discordWrites!==0||
    manifest.newThreadsToCreate!==0||!Array.isArray(manifest.proposals)||
    manifest.proposals.length!==99||!/^\d{17,20}$/.test(botUserId||'')||
    typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||
    typeof readThread!=='function'||typeof readMessages!=='function')
   reject('invalid read-only manifest or audit adapter');
 const seenReceipts=new Set(),threadGroups=new Map();
 for(const p of manifest.proposals){
  if(!p||!Object.hasOwn(forums,p.group)||!/^\d{17,20}$/.test(p.existingThreadId||'')||
    p.publicationAuthorized!==false||p.approval!=='not-granted'||
    p.targetKind!=='existing-thread'||typeof p.content!=='string'||
    p.sha256!==hash(p.content)||!Array.isArray(p.sourceUrls)||!p.sourceUrls.length||
    typeof p.receiptKey!=='string'||!(/^[a-f0-9]{64}$/.test(p.receiptKey))||
    seenReceipts.has(p.receiptKey))
    reject('invalid or reused release proposal receipt');
  seenReceipts.add(p.receiptKey);
  if(!threadGroups.has(p.existingThreadId))threadGroups.set(p.existingThreadId,[]);
  threadGroups.get(p.existingThreadId).push(p);
 }
 if(threadGroups.size!==97)reject('expected 97 shared existing thread IDs');
 const summary={
  observedAt,distinctThreadCount:97,proposalCount:99,ownerVerified:0,completeReadWindow:0,
  alreadyLinked:0,partialLinked:0,missingLinks:0,archivedProposals:0,archiveDrift:0,
  lockedThreads:0,publicationAuthorized:false,discordWrites:0,
  byGroup:{guppy:{total:0,linked:0,partial:0,missing:0},corydoras:{total:0,linked:0,partial:0,missing:0},pleco:{total:0,linked:0,partial:0,missing:0}},
  differences:[],
  conclusion:'REVIEW_ONLY_NO_DISCORD_WRITES'
 };
 const threads=[...threadGroups.entries()];
 let next=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(next<threads.length){
   const [threadId,group]=threads[next++];
   const first=group[0];
   const expectedParent=forums[first.group];
   if(group.some(x=>forums[x.group]!==expectedParent))reject('cross-category target collision');
   const [thread,messages]=await Promise.all([readThread(threadId),readMessages(threadId)]);
   if(!thread||thread.id!==threadId||thread.parentId!==expectedParent||
      typeof thread.archived!=='boolean'||typeof thread.locked!=='boolean'||
      !Array.isArray(messages)||!messages.length||messages.some(m=>typeof m.content!=='string'))
     reject('unreadable or misrouted forum thread '+threadId);
   const starter=messages.find(x=>x.id===threadId);
   if(!starter||starter.authorId!==botUserId)
     reject('starter ownership unverified '+threadId);
   summary.ownerVerified++;
   if(messages.length<25)summary.completeReadWindow++;
   if(thread.locked)summary.lockedThreads++;
   for(const proposal of group){
    const subset=proposal.sourceUrls.filter(url=>messages.some(m=>m.content.includes(url)));
    const matched=subset.length===proposal.sourceUrls.length;
    const partial=subset.length>0&&!matched;
    if(matched)summary.alreadyLinked++;
    else if(partial)summary.partialLinked++;
    else summary.missingLinks++;
    const lane=summary.byGroup[proposal.group];
    lane.total++;
    if(matched)lane.linked++;
    else if(partial)lane.partial++;
    else lane.missing++;
    if(thread.archived)summary.archivedProposals++;
    if(proposal.archived!==thread.archived){
     summary.archiveDrift++;
     summary.differences.push({receiptKey:proposal.receiptKey,reason:'archive-status-changed',threadId});
    }
   }
  }
 }));
 if(summary.ownerVerified!==97||summary.alreadyLinked+summary.partialLinked+summary.missingLinks!==99)
  reject('partial thread scan');
 summary.differences.sort((a,b)=>a.receiptKey.localeCompare(b.receiptKey));
 return summary;
}
