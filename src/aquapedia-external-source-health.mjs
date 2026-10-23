/**
 * Non-destructive HEAD reachability classification of known external links.
 * Forbidden inference: 403, 429, 5xx, or HEAD restrictions prove URL broken.
 */
const refuse=why=>{throw new Error('Citation health: '+why)};

function expectedCitations(source){
 if(!source||!Array.isArray(source.records))
  refuse('invalid evidence input');
 const urls=new Set();
 for(const row of source.records){
  if(!row||typeof row.url!=='string'||!Array.isArray(row.links)||!row.links.length)
   refuse('untrusted source record');
  for(const url of row.links)urls.add(url);
 }
 return urls;
}

function validatedHeadResults(externalHeads,expected){
 if(!Array.isArray(externalHeads))refuse('invalid evidence input');
 const results=new Map();
 for(const row of externalHeads){
  if(!row||typeof row.url!=='string'||!expected.has(row.url)||results.has(row.url))
   refuse('duplicate or unknown cited source URL');
  if(!['reachable_head','http_status','head_unavailable'].includes(row.outcome)||
    (row.outcome==='reachable_head'&&!(row.status>=200&&row.status<400)))
   refuse('invalid head result');
  results.set(row.url,row);
 }
 if(results.size!==expected.size)refuse('source HEAD audit incomplete');
 return results;
}

function sourceCoverage(records,results){
 const affectedUrls=[];
 let hasReachable=0;
 for(const row of records){
  const accessible=row.links.some(link=>results.get(link)?.outcome==='reachable_head');
  if(accessible)hasReachable++;
  else affectedUrls.push(row.url);
 }
 affectedUrls.sort((a,b)=>a.localeCompare(b));
 return {hasReachable,affectedUrls};
}

export function summarizeCitationHeadAccessibility(source,externalHeads){
 const expected=expectedCitations(source);
 const results=validatedHeadResults(externalHeads,expected);
 const {hasReachable,affectedUrls}=sourceCoverage(source.records,results);
 const reachable=[...results.values()].filter(x=>x.outcome==='reachable_head').length;
 return {
  refTotals:{checked:results.size,reachableByHead:reachable,inaccessibleByHead:results.size-reachable},
  pageTotals:{audited:source.records.length,hasReachableSource:hasReachable,onlyRestrictedSources:affectedUrls.length},
  affectedUrls,
  sourceClaimsVerified:false,linksProvenBroken:0,publicationAuthorized:false
 };
}
