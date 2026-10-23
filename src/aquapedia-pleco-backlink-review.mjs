/**
 * Read-only Plecopedia content-link parity / correction preview.
 * A research thread existing is not the same as an exact website backlink.
 * Absolutely no Discord write API, scheduler, tokens or thread creation.
 */
import {classifyCrossTaxaRecord} from './aquapedia-cross-taxa-publication-policy.mjs';
const GUILD_ID='1519337502379475095';
const FORUM_ID='1560931428680601630';
const HISTORICAL_ALIAS_URL='/plecopedia/research/soromoni-stearleyi/';
const HISTORICAL_THREAD_ID='1561147018473381900';
const reject=reason=>{throw Error('Pleco backlink review: '+reason)};

function siteRowLookup(siteRows){
 const siteByUrl=new Map();
 for(const row of siteRows){
  let result;
  try{result=classifyCrossTaxaRecord(row);}
  catch(e){reject(e.message);}
  if(result.decision!=='hold_draft'||result.group!=='pleco')
   reject('a record changed review status');
  if(typeof row.slug!=='string'||!row.slug.trim()||siteByUrl.has(row.url))
   reject('duplicate or malformed source');
  siteByUrl.set(row.url,row);
 }
 return siteByUrl;
}

function validatePlecoThread(r,siteByUrl,seenThreadIds,seenLedgerUrls){
 if(!r||typeof r.url!=='string'||seenLedgerUrls.has(r.url)||!siteByUrl.has(r.url))
  reject('untrusted or duplicated source URL');
 seenLedgerUrls.add(r.url);
 if(!/^\d{17,20}$/.test(r.threadId||'')||seenThreadIds.has(r.threadId))
  reject('untrusted or reused forum thread ID');
 seenThreadIds.add(r.threadId);
 if(r.botOwned!==true||r.externalSources!==true||typeof r.articleLinked!=='boolean'||
    typeof r.archived!=='boolean'||typeof r.alias!=='boolean'||
    !Number.isInteger(r.sampledMessages)||r.sampledMessages<1||r.sampledMessages>=25)
  reject('unverifiable starter, source status or incomplete message history');
 const row=siteByUrl.get(r.url);
 if(row.slug!==r.slug)reject('slug drift');
 if(r.alias!==(r.url===HISTORICAL_ALIAS_URL))
  reject('unexpected historical alias');
 if(r.alias&&r.threadId!==HISTORICAL_THREAD_ID)
  reject('historical taxon mapping changed');
 return row;
}

function plecoReviewDraft(r,row,threadUrl){
 const sourceUrl='https://aquapedia.app'+r.url;
 const content=[
  '**Plecopedia source link — EDITORIAL REVIEW DRAFT, NOT POSTED**',
  'Matching research entry: '+sourceUrl,
  'Research status: '+row.status+'.',
  'The research record is not proof of a breeding origin, identified founder line, or verified aquarium specimen.',
  'Check its original references and media rights before an authorized existing-thread update.'
 ].join('\n');
 if(content.length>=1900||content.includes('@everyone')||content.includes('@here'))
  reject('unsafe draft text');
 return {url:r.url,slug:r.slug,existingThreadId:r.threadId,existingThreadUrl:threadUrl,
  archived:r.archived,content,publicationAuthorized:false,newThreadRequested:false};
}

function appendPlecoThread(r,siteByUrl,seenThreadIds,seenLedgerUrls,review){
 const row=validatePlecoThread(r,siteByUrl,seenThreadIds,seenLedgerUrls);
 const threadUrl='https://discord.com/channels/'+GUILD_ID+'/'+r.threadId;
 if(r.alias)review.aliases.push({url:r.url,existingThreadId:r.threadId,threadUrl});
 if(r.archived)review.totalArchivedTargets++;
 if(r.articleLinked){review.existingBacklinks++;return;}
 review.missingBacklinks++;
 if(r.archived)review.archivedDraftTargets++;
 review.drafts.push(plecoReviewDraft(r,row,threadUrl));
}

export function buildPlecoArticleBacklinkReview(siteRows,ledger){
 if(!Array.isArray(siteRows)||siteRows.length!==167||
    !ledger||ledger.forumId!==FORUM_ID||typeof ledger.at!=='string'||
    !/^2026-\d{2}-\d{2}T/.test(ledger.at)||
    !Array.isArray(ledger.records)||ledger.records.length!==167)
  reject('expected public 167-record site and audited forum snapshot');
 const siteByUrl=siteRowLookup(siteRows);
 const seenThreadIds=new Set(),seenLedgerUrls=new Set();
 const review={
  total:167,existingBacklinks:0,missingBacklinks:0,totalArchivedTargets:0,archivedDraftTargets:0,
  archiveMutations:0,publicationAuthorized:false,newThreadsToCreate:0,discordWrites:0,
  drafts:[],aliases:[]
 };
 for(const r of ledger.records)
  appendPlecoThread(r,siteByUrl,seenThreadIds,seenLedgerUrls,review);
 if(review.existingBacklinks+review.missingBacklinks!==167||review.aliases.length!==1)
  reject('incomplete audit total');
 return review;
}
