/**
 * Reconcile three authenticated original-description source posts against
 * frozen review manifest, proving exactly three added original Discord
 * messages and retaining all other research and archived release holds.
 */
import {createHash} from 'node:crypto';
import {buildPlecoThreeDirectSourceIndex,PLECO_THREE_DIRECT_DESCRIPTIONS} from './aquapedia-pleco-three-direct-descriptions.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=s=>{throw Error('Pleco direct-description receipts: '+s)};
export function reconcileThreeDirectPlecoDescriptions(catalog,proof,manifest,priorFive,priorSeven){
 if(!Array.isArray(catalog)||catalog.length!==167||
   proof?.verified!==true||proof.repeatAction!=='adopted'||proof.otherDraftsAuthorized!==false||
   proof.records?.length!==3||
   manifest?.publicationAuthorized!==false||manifest.proposals?.length!==99||
   priorFive?.verified!==true||priorFive.records?.length!==5||
   priorSeven?.verified!==true||priorSeven.records?.length!==7)
   fail('missing baseline or authentic receipt cohort');
 const used=new Set([...priorFive.records,...priorSeven.records].map(x=>x.messageId));
 if(used.size!==12)fail('duplicate previous receipt id');
 const keys=Object.keys(PLECO_THREE_DIRECT_DESCRIPTIONS),completed=[];
 for(const key of keys){
  const plan=buildPlecoThreeDirectSourceIndex(catalog,key);
  const group=proof.records.filter(x=>x.key===key);
  if(group.length!==1)fail('missing/duplicate source receipt '+key);
  const r=group[0];
  if(r.verified!==true||r.threadId!==plan.threadId||r.sourceUrl!==plan.pageUrl||
    r.doi!==plan.doi||r.contentSha256!==sha(plan.content)||
    !/^\d{17,20}$/.test(r.messageId||'')||
    !/^\d{17,20}$/.test(r.botAuthorId||'')||
    used.has(r.messageId)||
    r.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+r.messageId)
   fail('source/bot/message readback mismatch '+key);
  used.add(r.messageId);
  const id='pleco:research-article-backlink:'+key;
  const historical=manifest.proposals.find(x=>x.id===id);
  if(!historical||historical.archived!==false||historical.group!=='pleco'||
     historical.existingThreadId!==plan.threadId||
     historical.sourceUrls?.join('|')!==plan.pageUrl)
   fail('frozen thread/source mapping mismatch '+key);
  completed.push({id,url:r.url,key,messageId:r.messageId});
 }
 if(completed.length!==3||used.size!==15)fail('source-only receipt count mismatch');
 const released=new Set([
  ...priorFive.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...priorSeven.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...completed.map(x=>x.id),
  ...['burgessi','davidsandsi','nattereri','xinguense'].map(x=>'corydoras:research-section-backlink:hoplisoma-'+x+'-breeding')
 ]);
 const pending=manifest.proposals.filter(x=>x.group!=='guppy'&&!released.has(x.id));
 if(released.size!==19||pending.length!==76||
  pending.filter(x=>!x.archived).length!==40||
  pending.filter(x=>x.archived).length!==36)
  fail('unreleased set has drifted');
 return {
  verifiedDirectDescriptionMessages:3,
  completedIds:completed.map(x=>x.id),
  published:completed,
  pendingCount:76,activePleco:40,archivedHeld:36,
  byGroup:{pleco:70,corydoras:6},
  remainingPublicationAuthorized:false,
  scientificClaimVerified:false,
  discordWritesInReconciliation:0
 };
}
