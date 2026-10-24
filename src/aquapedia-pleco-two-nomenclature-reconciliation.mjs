import {createHash} from 'node:crypto';
import {buildPlecoNomenclatureIndex,PLECO_NOMENCLATURE_TARGETS} from './aquapedia-pleco-two-nomenclature.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=s=>{throw Error('Pleco nomenclature receipt reconciliation: '+s)};
export function reconcileTwoPlecoNames(catalog,receiptSet,manifest,firstFive,nextSeven,nextThree){
 if(!Array.isArray(catalog)||catalog.length!==167||
   receiptSet?.verified!==true||receiptSet.repeatAction!=='adopted'||
   receiptSet.otherDraftsAuthorized!==false||receiptSet.records?.length!==2||
   manifest?.publicationAuthorized!==false||manifest.proposals?.length!==99||
   firstFive?.records?.length!==5||nextSeven?.records?.length!==7||nextThree?.records?.length!==3)
   fail('untrusted frozen source or proof');
 const used=new Set([...firstFive.records,...nextSeven.records,...nextThree.records].map(x=>x.messageId));
 if(used.size!==15)fail('duplicate pre-existing receipt ID');
 const published=[],completed=new Set();
 for(const key of Object.keys(PLECO_NOMENCLATURE_TARGETS)){
  const plan=buildPlecoNomenclatureIndex(catalog,key);
  const records=receiptSet.records.filter(x=>x.key===key);
  if(records.length!==1)fail('missing or duplicate nomenclature receipt '+key);
  const r=records[0];
  if(r.verified!==true||r.threadId!==plan.threadId||
    r.sourceUrl!==plan.pageUrl||r.originalReference!==plan.originalSource||
    r.contentSha256!==sha(plan.content)||used.has(r.messageId)||
    !/^\d{17,20}$/.test(r.messageId||'')||
    !/^\d{17,20}$/.test(r.botAuthorId||'')||
    r.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+r.messageId)
   fail('receipt/content/original-source mismatch '+key);
  used.add(r.messageId);
  const id='pleco:research-article-backlink:'+key;
  const original=manifest.proposals.find(x=>x.id===id);
  if(!original||original.archived||original.group!=='pleco'||
    original.existingThreadId!==plan.threadId||
    original.sourceUrls?.join('|')!==plan.pageUrl)
   fail('frozen proposal and public thread mapping differs '+key);
  completed.add(id);
  published.push({key,id,threadId:r.threadId,messageId:r.messageId,url:r.url});
 }
 if(completed.size!==2||used.size!==17)fail('duplicate or incomplete source-only names');
 const released=new Set([
  ...firstFive.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...nextSeven.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...nextThree.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...completed,
  ...['burgessi','davidsandsi','nattereri','xinguense'].map(k=>'corydoras:research-section-backlink:hoplisoma-'+k+'-breeding')
 ]);
 const pending=manifest.proposals.filter(x=>x.group!=='guppy'&&!released.has(x.id));
 if(released.size!==21||pending.length!==74||
   pending.filter(x=>!x.archived).length!==38||
   pending.filter(x=>x.archived).length!==36)
   fail('unreviewed candidate count drift');
 return {
  verifiedNomenclatureMessages:2,
  completedIds:[...completed],published,
  pendingCount:74,activePleco:38,archivedHeld:36,
  byGroup:{pleco:68,corydoras:6},
  remainingPublicationAuthorized:false,geneticPedigreesVerified:false,
  discordWritesDuringReconciliation:0
 };
}
