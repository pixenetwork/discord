/**
 * READ-ONLY live page/source link parity, Plecopedia's 55 active review
 * drafts. Scans only Aquapedia public HTML, writes metadata URL diffs, never
 * follows/rehosts third-party copyrighted content or posts to Discord.
 */
import fs from 'node:fs';
import {collectAquapediaCitationLinks} from '../src/aquapedia-source-citation-audit.mjs';
const original=JSON.parse(fs.readFileSync('resources/aquapedia-pleco-active-55-editorial-review-20261023.json','utf8'));
const bibliography=JSON.parse(fs.readFileSync('resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json','utf8').replace(/^\uFEFF/,''));
if(original.rows?.length!==55||bibliography.rows?.length!==24)
 throw Error('Input review cohorts changed');
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Live catalog HTTP '+response.status);
const live=await response.json();
const byUrl=new Map(live.filter(x=>x.group==='pleco').map(x=>['https://aquapedia.app'+x.url,x]));
if(byUrl.size!==167)throw Error('Pleco source cohort drift');
const rows=[];let cursor=0;
await Promise.all(Array.from({length:5},async()=>{
 while(cursor<original.rows.length){
  const reference=original.rows[cursor++];
  const expected=reference.evidence.map(x=>x.url);
  const missing=[],added=[];
  let pageStatus=null,liveStatus=null,issue=null,links=[];
  try{
   const row=byUrl.get(reference.site_url);
   if(!row)throw Error('Source URL absent from live catalog');
   liveStatus=row.status;
   const page=await fetch(reference.site_url,{signal:AbortSignal.timeout(18000)});
   pageStatus=page.status;
   if(!page.ok)throw Error('HTTP '+page.status);
   const citation=collectAquapediaCitationLinks(reference.site_url,await page.text());
   links=citation.links;
   const normalize=s=>new URL(s).href;
   const known=new Set(expected.map(normalize)),current=new Set(links.map(normalize));
   for(const url of known)if(!current.has(url))missing.push(url);
   for(const url of current)if(!known.has(url))added.push(url);
  }catch(e){issue=String(e.message||e).slice(0,180);}
  rows.push({
   proposalId:reference.proposal_id,url:reference.site_url,threadId:reference.existing_thread_id,
   reviewLane:reference.editorial_lane,siteStatus:liveStatus,pageHttpStatus:pageStatus,
   priorCitationCount:expected.length,liveCitationCount:links.length,
   missingPriorCitations:missing,addedNewCitations:added,issue,
   ownerApproved:false,claimVerified:false,rightsVerified:false,postAuthorized:false
  });
 }
}));
rows.sort((a,b)=>a.proposalId.localeCompare(b.proposalId));
const cnt=f=>rows.filter(f).length;
const summary={checked:rows.length,pageHttp200:cnt(x=>x.pageHttpStatus===200),
 stableCitationList:cnt(x=>!x.issue&&!x.missingPriorCitations.length&&!x.addedNewCitations.length),
 missingPriorCitationPages:cnt(x=>x.missingPriorCitations.length>0),
 newlyAddedCitationPages:cnt(x=>x.addedNewCitations.length>0),
 errorPages:cnt(x=>!!x.issue),sourceStatusChanged:cnt(x=>x.siteStatus!=='Research draft — independent review pending')};
const report={capturedAt:new Date().toISOString(),liveCatalog:live.length,scope:'55 public Pleco article page URL and bibliography parity only',mode:'READ_ONLY',
 summary,rows,sourceClaimsVerified:false,mediaRightsVerified:false,
 publicationAuthorized:false,discordWrites:0};
const dest='resources/aquapedia-pleco-active-55-live-page-citations-20261023.json';
if(fs.existsSync(dest))throw Error('Evidence already exists, use versioned file');
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('PLECO_55_LIVE_CITATION_PARITY '+JSON.stringify({summary,firstDiffs:rows.filter(x=>x.issue||x.missingPriorCitations.length||x.addedNewCitations.length).slice(0,8).map(x=>({url:x.url,issue:x.issue,removed:x.missingPriorCitations.length,added:x.addedNewCitations.length}))}));
