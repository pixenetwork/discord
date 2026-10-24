/**
 * Inert Corydoraspedia article-to-existing-forum link review.
 * Captured public forum evidence is an audit input, never a publishing permit.
 * No Discord credentials, network or write-capable dependencies are imported.
 */
import {classifyCrossTaxaRecord} from './aquapedia-cross-taxa-publication-policy.mjs';
const FORUM_ID='1560887812910350339';
const GUILD_ID='1519337502379475095';
const REQUIRES_SPECIAL_REVIEW=new Map([
 ['red-laser','Named Red Laser selected line vs CW023 taxon thread; lineage-to-species equivalence not established'],
 ['hoplisoma-weitzmani-breeding','Source name Hoplisoma weitzmani differs from forum Hoplisoma weitzmanii; confirm nomenclature']
]);
const reject=reason=>{throw Error('Cory review: '+reason)};
const normalize=x=>String(x).normalize('NFKC').trim();
const urlForThread=id=>'https://discord.com/channels/'+GUILD_ID+'/'+id;

export function buildCorySectionLinkReview(sourceRecords,snapshot){
 if(!Array.isArray(sourceRecords)||sourceRecords.length!==19||
  !snapshot||snapshot.forumId!==FORUM_ID||!Array.isArray(snapshot.records)||snapshot.records.length!==19||
  !/^2026-\d{2}-\d{2}T/.test(snapshot.capturedAt||''))
  reject('expected pinned 19-record public cohort and real dated forum snapshot');
 const sourceBySlug=new Map(),snapBySlug=new Map();
 let breeding=0,lineages=0;
 for(const r of sourceRecords){
  if(!r||typeof r.slug!=='string'||sourceBySlug.has(r.slug))reject('source slug collision');
  let status;try{status=classifyCrossTaxaRecord(r);}catch(e){reject(e.message);}
  if(status.group!=='corydoras'||status.kind!=='anchor'||status.decision!=='hold_anchor')reject('not a held Cory section');
  if(!r.url.endsWith('#'+r.url.split('#')[1]))reject('source URL fragment changed');
  if(r.url.startsWith('/corydoraspedia/lineages/#'))lineages++;
  else if(r.url.startsWith('/corydoraspedia/breeding/#'))breeding++;
  else reject('untrusted page section');
  sourceBySlug.set(r.slug,r);
 }
 if(lineages!==8||breeding!==11)reject('site taxonomy count changed');
 for(const entry of snapshot.records){
  if(!entry||typeof entry.slug!=='string'||snapBySlug.has(entry.slug))reject('snapshot duplicate or missing slug');
  snapBySlug.set(entry.slug,entry);
 }
 const result={total:19,drafts:[],ambiguous:[],namingOrLineageReview:[],previouslyLinked:0,
  publicationAuthorized:false,newThreadsToCreate:0,discordWrites:0};
 for(const [slug,r] of sourceBySlug){
  const item=snapBySlug.get(slug);
  if(!item||item.name!==r.name||item.url!==r.url||item.status!==r.status||item.type!==r.type)
   reject('live source identity drift '+slug);
  if(!Array.isArray(item.candidates)||item.candidates.length<1||item.candidates.length>2)
   reject('unverifiable destination count '+slug);
  const candidateIds=new Set();
  const candidates=item.candidates.map(t=>{
   if(!t||typeof t.id!=='string'||!/^\d{17,20}$/.test(t.id)||candidateIds.has(t.id)||
      typeof t.name!=='string'||!t.name.trim()||
      t.parentId!==FORUM_ID||t.starterOwnedByBot!==true||
      typeof t.archived!=='boolean'||typeof t.locked!=='boolean'||
      !Number.isInteger(t.recentMessageCount)||t.recentMessageCount<1||
      t.sourceLinkAlreadyPresent!==false)
     reject('untrusted or newly modified source forum thread '+slug);
   candidateIds.add(t.id);
   return {id:t.id,name:t.name,archived:t.archived,locked:t.locked,
     threadUrl:urlForThread(t.id)};
  });
  if(candidates.length===2){result.ambiguous.push({slug,sourceUrl:'https://aquapedia.app'+r.url,candidates,
    reason:'multiple related morph/taxon candidates; editorial routing required'});continue;}
  const one=candidates[0];
  if(REQUIRES_SPECIAL_REVIEW.has(slug)){
   result.namingOrLineageReview.push({slug,sourceUrl:'https://aquapedia.app'+r.url,candidates,
     reason:REQUIRES_SPECIAL_REVIEW.get(slug)});continue;
  }
  if(!r.url.startsWith('/corydoraspedia/breeding/#') ||
    r.status!=='Keeper observation; not a universal target')
   reject('unrecognized single-candidate lineage evidence');
  const content=[
   '**Corydoraspedia section link — EDITORIAL DRAFT, NOT POSTED**',
   'Evidence section: https://aquapedia.app'+r.url,
   'Research status: '+r.status,
   'Linked observations are not universal care targets and not evidence of founding parentage.',
   'Please cross-check the original citations and rights before publication.'
  ].join('\n');
  if(content.length>1900||content.includes('@everyone')||content.includes('@here'))
   reject('unsafe draft content');
  result.drafts.push({slug,sourceUrl:'https://aquapedia.app'+r.url,
   existingThreadId:one.id,existingThreadUrl:one.threadUrl,archived:one.archived,
   content,publicationAuthorized:false,newThreadRequested:false});
 }
 if(result.drafts.length!==10||result.ambiguous.length!==7||result.namingOrLineageReview.length!==2)
  reject('source-to-forum review counts changed');
 return result;
}
