import {createHash} from 'node:crypto';
import {buildPlecoNamedSourceIndex,PLECO_NAMED_SOURCE_TARGETS} from './aquapedia-pleco-two-named-source.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=s=>{throw Error('Pleco two named-species receipts: '+s)};
export function reconcileTwoNamedPlecoSources(catalog,proof,manifest,priorFive,priorSeven,priorThree,priorTwo){
 if(!Array.isArray(catalog)||catalog.length!==167||
  proof?.verified!==true||proof.repeatAction!=='adopted'||proof.records?.length!==2||
  proof.otherDraftsAuthorized!==false||
  manifest?.publicationAuthorized!==false||manifest.proposals?.length!==99||
  priorFive?.records?.length!==5||priorSeven?.records?.length!==7||
  priorThree?.records?.length!==3||priorTwo?.records?.length!==2)
  fail('untrusted source or original publication baselines');
 const earlier=[...priorFive.records,...priorSeven.records,...priorThree.records,...priorTwo.records];
 const known=new Set(earlier.map(x=>x.messageId));
 if(known.size!==17)fail('duplicate prior message receipts');
 const completed=[];
 for(const key of Object.keys(PLECO_NAMED_SOURCE_TARGETS)){
  const plan=buildPlecoNamedSourceIndex(catalog,key);
  const candidates=proof.records.filter(x=>x.key===key);
  if(candidates.length!==1)fail('missing/duplicate named species receipt '+key);
  const r=candidates[0];
  if(!r.verified||r.threadId!==plan.threadId||r.sourceUrl!==plan.pageUrl||
    r.catalogUrl!==plan.catalogUrl||r.messageSha256!==sha(plan.content)||
    !/^\d{17,20}$/.test(r.messageId||'')||
    !/^\d{17,20}$/.test(r.botAuthorId||'')||
    known.has(r.messageId)||
    r.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+r.messageId)
   fail('authored message or original taxonomic source mismatch '+key);
  known.add(r.messageId);
  const id='pleco:research-article-backlink:'+key;
  const proposal=manifest.proposals.find(x=>x.id===id);
  if(!proposal||proposal.archived||proposal.group!=='pleco'||
    proposal.existingThreadId!==plan.threadId||
    proposal.sourceUrls?.join('|')!==plan.pageUrl)
   fail('original source URL/thread approval mapping differs '+key);
  completed.push({id,key,url:r.url,threadId:r.threadId,messageId:r.messageId});
 }
 if(completed.length!==2||known.size!==19)fail('incorrect source-only receipt count');
 const released=new Set([
  ...earlier.map(x=>'pleco:research-article-backlink:'+x.key),
  ...completed.map(x=>x.id),
  ...['burgessi','davidsandsi','nattereri','xinguense'].map(k=>'corydoras:research-section-backlink:hoplisoma-'+k+'-breeding')
 ]);
 const remaining=manifest.proposals.filter(x=>x.group!=='guppy'&&!released.has(x.id));
 if(released.size!==23||remaining.length!==72||
   remaining.filter(x=>!x.archived).length!==36||
   remaining.filter(x=>x.archived).length!==36)
   fail('unverified review queue count changed');
 return {
  verifiedNamedSpeciesPosts:2,completedIds:completed.map(x=>x.id),published:completed,
  pendingCount:72,activePleco:36,archivedHeld:36,
  byGroup:{pleco:66,corydoras:6},
  remainingPublicationAuthorized:false,specimenVerificationGranted:false,
  discordWritesDuringReconciliation:0
 };
}
