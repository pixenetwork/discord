/**
 * Public HTML evidence only: 8 pending Pleco bibliography roles.
 * Source URL exists on that page != external paper proves every claim.
 * Never publishes or reads private Discord records.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {collectAquapediaCitationLinks} from '../src/aquapedia-source-citation-audit.mjs';
const root='resources/';
const input=JSON.parse(fs.readFileSync(root+'aquapedia-pleco-eight-source-roles-20261024.json','utf8'));
const output=root+'aquapedia-pleco-eight-live-citation-readback-20261024.json';
if(fs.existsSync(output))throw Error('Never overwrite source evidence snapshot');
if(input.records?.length!==8||input.publicationAuthorized!==false)throw Error('Untrusted editorial research matrix');
const queue=JSON.parse(execFileSync(process.execPath,['tools/read-aquapedia-cross-taxa-current-queue.mjs','--queue'],{encoding:'utf8'}));
const liveRes=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
if(!liveRes.ok)throw Error('Live Aquapedia catalog HTTP '+liveRes.status);
const catalog=await liveRes.json();
const plecos=catalog.filter(x=>x.group==='pleco');
if(plecos.length!==167||queue.activeCount!==36||queue.archivedHeld!==36)throw Error('Source or review queue drift');
const activeIds=new Set(queue.activeBatches.flatMap(x=>x.items).map(x=>x.id));
const results=[];
for(const x of input.records){
 const id='pleco:research-article-backlink:'+x.slug;
 const row=plecos.filter(y=>y.slug===x.slug);
 if(row.length!==1||row[0].status!=='Research draft — independent review pending'||!activeIds.has(id))
  throw Error('Unexpected release candidacy drift '+x.slug);
 const url='https://aquapedia.app'+row[0].url;
 const response=await fetch(url,{signal:AbortSignal.timeout(16000)});
 const html=response.ok?await response.text():'';
 const links=response.ok?collectAquapediaCitationLinks(url,html).links:[];
 const target=new URL(x.source).href.toLowerCase();
 const found=links.some(y=>y.toLowerCase()===target);
 results.push({
  slug:x.slug,pageUrl:url,pageHttp:response.status,status:row[0].status,
  reviewRole:x.researchRole,originalSourceUrl:x.source,
  exactCitationPresent:found,externalCitationCount:links.length,
  independentClaimVerification:false,proposedReleaseApproved:false,
  discordWrites:0
 });
}
const counts={checked:results.length,http200:results.filter(x=>x.pageHttp===200).length,
 exactCitationPresent:results.filter(x=>x.exactCitationPresent).length,
 exactCitationMissing:results.filter(x=>!x.exactCitationPresent).length,
 originals:input.records.filter(x=>x.researchRole.startsWith('original')).length,
 held:input.records.filter(x=>x.reviewResult.endsWith('-hold')).length};
const report={capturedAt:new Date().toISOString(),scope:'eight pending Plecopedia live source link presence and claim-role triage',
 liveCatalogCount:catalog.length,sourceRoleMatrix:'resources/aquapedia-pleco-eight-source-roles-20261024.json',
 currentQueue:queue.pendingCount,publishedLinksDuringAudit:0,publicationAuthorized:false,
 counts,results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('PLECO_EIGHT_LIVE_SOURCE_AUDIT '+JSON.stringify(counts));
for(const row of results.filter(x=>!x.exactCitationPresent))console.log('MISSING_SOURCE '+row.slug+' '+row.originalSourceUrl);
