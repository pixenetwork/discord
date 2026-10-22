/**
 * Generate a dated, non-publishing citation-link presence ledger from
 * public Aquapedia source pages referenced by draft PR #60.
 * No third-party source reuse, no claim approval, no Discord writes.
 */
import fs from 'node:fs';
import {collectAquapediaCitationLinks} from '../src/aquapedia-source-citation-audit.mjs';
const manifest=JSON.parse(fs.readFileSync('resources/aquapedia-cross-taxa-release-review-20261021.json','utf8'));
if(manifest.publicationAuthorized||manifest.proposals.length!==99)throw Error('Untrusted release manifest');
const rows=[...new Set(manifest.proposals.flatMap(p=>p.sourceUrls))].sort();
if(rows.length!==143)throw Error('Source URL coverage drift');
const mainPage=u=>u.split('#')[0];
const pages=[...new Set(rows.map(mainPage))];
const htmlByPage=new Map(), errors=[];
let cursor=0;
await Promise.all(Array.from({length:7},async()=>{
 while(cursor<pages.length){
  const url=pages[cursor++];
  try{
   const res=await fetch(url,{signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw Error('HTTP '+res.status);
   const html=await res.text();
   if(html.length<250)throw Error('Too-short source page');
   htmlByPage.set(url,html);
  }catch(e){errors.push({url,error:String(e).slice(0,160)});}
 }
}));
if(errors.length)throw Error('Source fetch failures '+JSON.stringify(errors.slice(0,10)));
const records=rows.map(url=>collectAquapediaCitationLinks(url,htmlByPage.get(mainPage(url))));
const counts={guppy:0,corydoras:0,pleco:0};
const missing={guppy:0,corydoras:0,pleco:0};
const domainCount=new Map();
for(const x of records){
 const category=new URL(x.url).pathname.split('/')[1].replace('guppypedia','guppy').replace('corydoraspedia','corydoras').replace('plecopedia','pleco');
 counts[category]++;
 if(x.externalCitationCount===0)missing[category]++;
 for(const link of x.links){const hostname=new URL(link).hostname;domainCount.set(hostname,(domainCount.get(hostname)||0)+1);}
}
const report={
 capturedAt:new Date().toISOString(),
 source:'live public Aquapedia HTML; external hrefs counted but linked documents not retrieved',
 proposedMessages:99,proposedSourceLinks:rows.length,uniqueFetchedPages:pages.length,
 counts,missing,withCitationLinks:records.filter(x=>x.externalCitationCount>0).length,
 totalDistinctDomains:domainCount.size,
 domains:[...domainCount].sort((a,b)=>b[1]-a[1]).map(([domain,count])=>({domain,count})),
 records,claimVerified:false,mediaRightsVerified:false,discordWrites:0,publicationAuthorized:false
};
const output='resources/aquapedia-cross-taxa-citation-presence-20261021.json';
if(fs.existsSync(output))throw Error('Citation output exists; version bump required');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const lines=[
 '# Aquapedia cross-taxa citation-link presence audit — REVIEW ONLY',
 '',
 'This report checks **external citation-link presence in live public Aquapedia HTML**. A working source link does not prove article quality, independent fact-checking, media permissions, or breeder lineage.',
 '',
 '- Source page readback: '+pages.length+' unique HTTP-200 public page documents, comprising '+rows.length+' individual proposed source URLs and 99 proposed Discord review entries.',
 '- Guppy record URLs: '+counts.guppy+'; without an external source link: '+missing.guppy+'.',
 '- Cory section anchors: '+counts.corydoras+'; without a **section-local** source link: '+missing.corydoras+'.',
 '- Pleco source entries: '+counts.pleco+'; without an external source link: '+missing.pleco+'.',
 '- Distinct external source hostnames (not individually vetted): '+domainCount.size+'.',
 '- Authorization: **NOT GRANTED**. Discord modifications: 0. Third-party images copied: 0.',
 '',
 '## Missing source-link records (publication hold)',
 ''
];
for(const row of records.filter(x=>!x.externalCitationCount))lines.push('- '+row.url);
lines.push('','## External citation hosts (count of article/anchor occurrences)','');
for(const [domain,count] of [...domainCount].sort((a,b)=>b[1]-a[1]))lines.push('- '+domain+': '+count);
lines.push('','Do not treat a hosted commercial listing, forum post, breeder report or DOI as equivalent grades of evidence. Further manual claim-level adjudication and source-rights review are required.');
const md='docs/operations/aquapedia-cross-taxa-citation-presence-20261021.md';
if(fs.existsSync(md))throw Error('Citation document exists; version bump required');
fs.writeFileSync(md,lines.join('\n')+'\n',{flag:'wx'});
console.log('CITATION_PRESENCE_AUDIT '+JSON.stringify({pages:pages.length,urls:rows.length,withCitationLinks:report.withCitationLinks,missing,counts,totalDistinctDomains:domainCount.size,firstMissing:records.filter(x=>!x.externalCitationCount).slice(0,10).map(x=>x.url),discordWrites:0}));
