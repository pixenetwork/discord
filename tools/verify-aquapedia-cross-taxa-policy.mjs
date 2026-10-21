/**
 * Read-only live cross-taxa source integrity audit for the existing
 * Aquapedia website. No bot token, no publisher, no checkpoint changes.
 */
import {buildCrossTaxaCoverage} from '../src/aquapedia-cross-taxa-publication-policy.mjs';
import {auditIkghGuppyCohort,IKGH_2023_URL} from '../src/aquapedia-guppy-ihs-crosswalk.mjs';
const base='https://aquapedia.app';
const response=await fetch(base+'/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Aquapedia catalog HTTP '+response.status);
const catalog=await response.json();
if(!Array.isArray(catalog)||catalog.length<850)throw Error('Unexpected live catalog shrinkage');
const excluded=catalog.filter(x=>['guppy','pleco','corydoras'].includes(x.group));
const plan=buildCrossTaxaCoverage(excluded,{},{
 expectedCounts:{guppy:176,pleco:167,corydoras:19},
 guildActiveThreads:null
});
if(plan.total!==362||plan.publicationAuthorized||plan.newThreadsToCreate)
 throw Error('Untrusted cross-taxa publication authorization');
const guppy=catalog.filter(x=>x.group==='guppy');
const standards=auditIkghGuppyCohort(guppy,{expectFullCohort:true});
async function load(path){
 const r=await fetch(base+path,{signal:AbortSignal.timeout(14000)});
 if(!r.ok)throw Error('Failed article '+path+': HTTP '+r.status);
 return r.text();
}
const parentPaths=[...new Set(catalog.filter(x=>x.group==='corydoras').map(x=>x.url.split('#')[0]))];
if(parentPaths.length!==2||!parentPaths.includes('/corydoraspedia/lineages/')||!parentPaths.includes('/corydoraspedia/breeding/'))
 throw Error('Corydoras page topology unexpectedly changed');
let coryAnchorsChecked=0;
for(const parent of parentPaths){
 const html=await load(parent);
 for(const row of catalog.filter(x=>x.group==='corydoras'&&x.url.startsWith(parent+'#'))){
  const anchor=row.url.split('#')[1];
  if(!html.includes('id="'+anchor+'"')&&!html.includes("id='"+anchor+"'"))
   throw Error('Missing live Corydoras anchor '+row.url);
  coryAnchorsChecked++;
 }
}
if(coryAnchorsChecked!==19)throw Error('Expected 19 real Corydoras anchors');
let next=0;
const rows=standards.records;
let guppyPagesVerified=0;
await Promise.all(Array.from({length:8},async()=>{
 while(next<rows.length){
  const v=rows[next++];
  const url='/guppypedia/entries/gup-'+v.id+'/';
  const html=await load(url);
  if(!html.includes(IKGH_2023_URL))
   throw Error('Guppy article missing primary source '+url);
  guppyPagesVerified++;
 }
}));
if(guppyPagesVerified!==48)throw Error('Not all Guppy standard pages inspected');
const pleco=await load('/plecopedia/research/soromoni-stearleyi/');
if(!pleco.includes('Pseudolithoxus stearleyi')||!pleco.includes('10.1643/CI-10-008'))
 throw Error('Pleco original diagnosis/source evidence missing');
console.log('CROSS_TAXA_SOURCE_AUDIT '+JSON.stringify({
 catalogTotal:catalog.length,excludedTotal:plan.total,
 cohorts:Object.fromEntries(Object.entries(plan.byGroup).map(([group,v])=>[group,{records:v.total,held:v.held,reviewRequired:v.pendingReview}])),
 guppySourceCodes:standards.counts,guppyIkghPagesVerified:guppyPagesVerified,
 coryPagesChecked:parentPaths.length,coryAnchorsChecked,plecoAliasPageChecked:true,
 writes:0,publicationAuthorized:false
}));
