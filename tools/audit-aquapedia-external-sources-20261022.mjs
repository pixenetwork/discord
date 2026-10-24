/**
 * External reference reachability audit. HEAD only; a 403/502 response
 * is NOT a broken-link determination, nor evidence of factual accuracy.
 */
import fs from 'node:fs';
import {summarizeCitationHeadAccessibility} from '../src/aquapedia-external-source-health.mjs';
const source=JSON.parse(fs.readFileSync('resources/aquapedia-cross-taxa-citation-presence-20261021.json','utf8'));
const urls=[...new Set(source.records.flatMap(x=>x.links))].sort((a,b)=>a.localeCompare(b));
if(urls.length!==109)throw Error('Public source inventory count changed');
const output=[];let i=0;
await Promise.all(Array.from({length:5},async()=>{
 while(i<urls.length){
  const url=urls[i++];
  try{
   const r=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(9000)});
   output.push({url,status:r.status,outcome:r.status>=200&&r.status<400?'reachable_head':'http_status',finalHostname:new URL(r.url).hostname});
  }catch(e){output.push({url,status:null,outcome:'head_unavailable',error:String(e.message||e).slice(0,150)});}
 }
}));
output.sort((a,b)=>a.url.localeCompare(b.url));
const summary=summarizeCitationHeadAccessibility(source,output);
const rowGroup=source.records.filter(r=>summary.affectedUrls.includes(r.url));
const byGroup=Object.fromEntries(['guppypedia','plecopedia','corydoraspedia'].map(g=>[g,rowGroup.filter(r=>r.url.includes('/'+g+'/')).length]));
const record={
 capturedAt:new Date().toISOString(),method:'HTTP HEAD only, no source content downloaded',
 ...summary,affectedByGroup:byGroup,
 sourceClaimsVerified:false,mediaRightsVerified:false,discordWrites:0,
 responseBreakdown:Object.fromEntries(Object.entries(Object.groupBy(output,x=>x.status===null?'network_failure':String(x.status))).map(([k,v])=>[k,v.length])),
 checks:output
};
const path='resources/aquapedia-external-source-head-20261022.json';
if(fs.existsSync(path))throw Error('Evidence file exists; do not overwrite');
fs.writeFileSync(path,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
const md=[
 '# Aquapedia third-party reference accessibility — October 22, 2026',
 '',
 '> **HEAD results are indicators only.** A 403 may be bot blocking or an authentication restriction; a 502 may be an upstream or transient failure. Neither proves an article or citation is false or a link permanently dead.',
 '',
 '- Source records with citations: '+source.records.length+' (48 Guppy, 10 Cory, 85 Pleco).',
 '- Unique third-party URLs checked: '+summary.refTotals.checked+'.',
 '- Reachable HEAD results: '+summary.refTotals.reachableByHead+'.',
 '- Not reachable by HEAD / restricted / transient: '+summary.refTotals.inaccessibleByHead+'.',
 '- Source records with at least one HEAD-reachable external citation: '+summary.pageTotals.hasReachableSource+'.',
 '- Source records with no HEAD-reachable citation: '+summary.pageTotals.onlyRestrictedSources+' (not necessarily broken).',
 '- The original Cory keeper-report set passed 10/10 in its separate dedicated source check.',
 '- Fact-checking, breeder photo rights and independent reviewer approval: **not established**.',
 '',
 '## Pages needing alternative access or human source review',
 '',
 ...summary.affectedUrls.map(url=>'- '+url),
 '',
 'Data: `resources/aquapedia-external-source-head-20261022.json`.',
 'No Discord posting, external article republishing, or canonical bot configuration changes occurred.'
];
const doc='docs/operations/aquapedia-external-source-head-20261022.md';
if(fs.existsSync(doc))throw Error('Document already exists');
fs.writeFileSync(doc,md.join('\n')+'\n',{flag:'wx'});
console.log('EXTERNAL_HEAD_STATUS '+JSON.stringify({checked:summary.refTotals.checked,reachableByHead:summary.refTotals.reachableByHead,unreachableByHead:summary.refTotals.inaccessibleByHead,sourcePagesWithReachable:summary.pageTotals.hasReachableSource,sourcePagesNeedingMoreReview:summary.pageTotals.onlyRestrictedSources,affectedByGroup:byGroup,breakdown:record.responseBreakdown,publicPosts:0}));
