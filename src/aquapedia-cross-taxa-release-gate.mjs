/**
 * Cross-taxa release MANIFEST PLANNER, read-only and non-publishing.
 * Public website data and real bot starter snapshots -> stable receipts.
 * This code never authorizes a public release or imports a Discord API.
 */
import {createHash} from 'node:crypto';
import {buildGuppyDiscordIndexPreview} from './aquapedia-guppy-discord-index-preview.mjs';
import {buildCorySectionLinkReview} from './aquapedia-cory-section-link-review.mjs';
import {buildPlecoArticleBacklinkReview} from './aquapedia-pleco-backlink-review.mjs';

const reject=reason=>{throw Error('Cross-taxa release gate: '+reason)};
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const uniqueList=xs=>[...new Set(xs)];
function freshness(date,now){
 const original=Date.parse(date),current=Date.parse(now);
 if(!Number.isFinite(original)||!Number.isFinite(current)||current<original)
  reject('invalid or future-dated evidence snapshot');
 const ageMinutes=Math.floor((current-original)/60000);
 return {capturedAt:date,ageMinutes,fresh:ageMinutes<=60};
}
/**
 * Proposals are never actionable, regardless of option flags.
 * Snapshot freshness is an informational warning; no proposed item is
 * publishable until an independent verified writer performs new checks.
 */
export function buildCrossTaxaReleaseGate(siteRecords,snapshots,{now}={}){
 if(!Array.isArray(siteRecords)||!snapshots||!snapshots.guppy||!snapshots.cory||!snapshots.pleco)
  reject('missing original source records or authenticated forum snapshots');
 if(typeof now!=='string'||!Number.isFinite(Date.parse(now)))reject('invalid audit time');
 const guppyRows=siteRecords.filter(x=>x.group==='guppy');
 const plecoRows=siteRecords.filter(x=>x.group==='pleco');
 const coryRows=siteRecords.filter(x=>x.group==='corydoras');
 if(guppyRows.length!==176||plecoRows.length!==167||coryRows.length!==19||siteRecords.length!==362)
  reject('cohort count drift');
 const snapshotFreshness={
  guppy:freshness(snapshots.guppy.capturedAt,now),
  cory:freshness(snapshots.cory.capturedAt,now),
  pleco:freshness(snapshots.pleco.at,now)
 };
 const guppy=buildGuppyDiscordIndexPreview(guppyRows,snapshots.guppy.threads,
  {guildActiveThreads:snapshots.guppy.guildActiveThreads});
 const cory=buildCorySectionLinkReview(coryRows,snapshots.cory);
 const pleco=buildPlecoArticleBacklinkReview(plecoRows,snapshots.pleco);
 const byGroup=[
  ...guppy.messages.map((x,i)=>({
   group:'guppy',kind:'show-phenotype-index',id:'index-'+x.group+'-'+(i+1),
   existingThreadId:x.threadId,archived:false,content:'[NOT POSTED]'+String.fromCharCode(10)+x.content,
   sourceUrls:x.recordIds.map(id=>'https://aquapedia.app/guppypedia/entries/'+id+'/'),
  })),
  ...cory.drafts.map(x=>({
   group:'corydoras',kind:'research-section-backlink',id:x.slug,
   existingThreadId:x.existingThreadId,archived:x.archived,content:x.content,sourceUrls:[x.sourceUrl]
  })),
  ...pleco.drafts.map(x=>({
   group:'pleco',kind:'research-article-backlink',id:x.slug,
   existingThreadId:x.existingThreadId,archived:x.archived,content:x.content,
   sourceUrls:['https://aquapedia.app'+x.url]
  }))
 ];
 const receipts=new Set();
 const proposals=byGroup.map(x=>{
  if(!/^\d{17,20}$/.test(x.existingThreadId)||
     !Array.isArray(x.sourceUrls)||!x.sourceUrls.length||
     x.sourceUrls.some(url=>!/^https:\/\/aquapedia\.app\/(guppypedia|corydoraspedia|plecopedia)\//.test(url))||
     typeof x.content!=='string'||!x.content.includes('NOT POSTED')||
     x.content.length>=1900||x.content.includes('@everyone')||x.content.includes('@here'))
   reject('untrusted draft content, target or source URL');
  const id=x.group+':'+x.kind+':'+x.id;
  const sha256=digest(x.content);
  const receiptKey=digest([id,x.existingThreadId,sha256,...x.sourceUrls].join('|'));
  if(receipts.has(receiptKey))reject('duplicate receipt identity '+id);
  receipts.add(receiptKey);
  return {...x,id,sha256,receiptKey,targetKind:'existing-thread',approval:'not-granted',publicationAuthorized:false};
 });
 const archivedTargets=proposals.filter(p=>p.archived).length;
 const counts={guppy:guppy.messages.length,corydoras:cory.drafts.length,pleco:pleco.drafts.length,
  proposedMessages:proposals.length,activeTargets:proposals.length-archivedTargets,archivedTargets,
  guppyTradeHeld:guppy.tradeRecordsHeld,coryAmbiguousHeld:cory.ambiguous.length,
  coryNamingHeld:cory.namingOrLineageReview.length,plecoAlreadyLinked:pleco.existingBacklinks};
 if(proposals.length!==99||archivedTargets!==36||counts.activeTargets!==63)
  reject('new content/source or forum status changed; regenerate live review');
 if(uniqueList(proposals.map(p=>p.id)).length!==proposals.length)
  reject('duplicate release proposal ID');
 return {sourceRecords:siteRecords.length,snapshotFreshness,counts,proposals,
  releaseEligibility:'BLOCKED_REVIEW_ONLY',publicationAuthorized:false,
  discordWrites:0,newThreadsToCreate:0,
  editorialHolds:{guppyTrade:128,coryAmbiguous:cory.ambiguous,coryNaming:cory.namingOrLineageReview},
  generatedForAuditAt:now};
}
