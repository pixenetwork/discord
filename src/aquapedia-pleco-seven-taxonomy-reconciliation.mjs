/**
 * Source-only taxonomy research indexing receipts. No permission to publish.
 */
import {createHash} from 'node:crypto';
import {buildPlecoTaxonomySourceIndex,PLECO_TAXONOMY_SOURCE_LINKS} from './aquapedia-pleco-seven-taxonomy-index.mjs';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const reject=s=>{throw Error('Pleco taxonomy receipt reconciliation: '+s)};
export function reconcileSevenPlecoTaxonomySources(catalog,receiptSet,manifest,priorFive){
 if(!Array.isArray(catalog)||catalog.length!==167||
   receiptSet?.verified!==true||receiptSet.repeatAction!=='adopted'||
   !Array.isArray(receiptSet.records)||receiptSet.records.length!==7||
   manifest?.publicationAuthorized!==false||manifest.proposals?.length!==99||
   priorFive?.verified!==true||priorFive.records?.length!==5)
   reject('invalid evidence baseline');
 const posted=new Set(priorFive.records.map(x=>x.messageId)),ids=new Set();
 const keys=Object.keys(PLECO_TAXONOMY_SOURCE_LINKS);
 for(const key of keys){
  const plan=buildPlecoTaxonomySourceIndex(catalog,key);
  const entries=receiptSet.records.filter(x=>x.key===key);
  if(entries.length!==1)reject('missing/duplicate receipt '+key);
  const r=entries[0];
  if(r.verified!==true||r.threadId!==plan.threadId||
    r.sourceUrl!==plan.pageUrl||r.doi!==plan.doi||
    r.contentSha256!==hash(plan.content)||
    !/^\d{17,20}$/.test(r.botAuthorId||'')||
    !/^\d{17,20}$/.test(r.messageId||'')||
    posted.has(r.messageId)||
    r.url!=='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+r.messageId)
   reject('message or DOI/target mismatch '+key);
  posted.add(r.messageId);
  const id='pleco:research-article-backlink:'+key;
  const proposal=manifest.proposals.find(x=>x.id===id);
  if(!proposal||proposal.archived||proposal.group!=='pleco'||
     proposal.existingThreadId!==plan.threadId||
     proposal.sourceUrls?.join('|')!==plan.pageUrl)
   reject('original frozen publication mapping drift '+key);
  ids.add(id);
 }
 if(ids.size!==7||posted.size!==12)reject('incorrect identity count');
 const completed=new Set([
  ...priorFive.records.map(x=>'pleco:research-article-backlink:'+x.key),
  ...ids,
  ...['burgessi','davidsandsi','nattereri','xinguense'].map(k=>'corydoras:research-section-backlink:hoplisoma-'+k+'-breeding')
 ]);
 const pending=manifest.proposals.filter(x=>x.group!=='guppy'&&!completed.has(x.id));
 if(completed.size!==16||pending.length!==79||
    pending.filter(x=>!x.archived).length!==43||
    pending.filter(x=>x.archived).length!==36)
   reject('remaining review queue changed unexpectedly');
 return {
  verifiedPlecoTaxonomyPosts:7,
  completedProposalIds:[...ids],
  remaining:79,activePleco:43,archivedHeld:36,
  byGroup:{pleco:73,corydoras:6},
  otherRecordsEditoriallyApproved:false,publicationAuthorized:false,
  discordWritesDuringReconciliation:0
 };
}
