import fs from 'node:fs';
import {buildPlecoThreeDirectSourceIndex,PLECO_THREE_DIRECT_DESCRIPTIONS} from '../src/aquapedia-pleco-three-direct-descriptions.mjs';
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Catalog HTTP '+response.status);
const all=await response.json();
const pleco=all.filter(x=>x.group==='pleco');
const result=[];
for(const key of Object.keys(PLECO_THREE_DIRECT_DESCRIPTIONS)){
 const plan=buildPlecoThreeDirectSourceIndex(pleco,key);
 const r=await fetch(plan.pageUrl,{signal:AbortSignal.timeout(15000)});
 const html=await r.text();
 const doi=plan.doi.toLowerCase();
 const registry=await fetch('https://api.crossref.org/works/'+encodeURIComponent(plan.doi),{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'AquapediaResearchReview/1.0'}});
 const registered=registry.ok?String((await registry.json()).message?.DOI||'').toLowerCase()===doi:false;
 result.push({key,http:r.status,containsDraft:html.includes('Research draft'),rawDoiVisible:html.toLowerCase().includes(doi),
   encodedDoiVisible:html.toLowerCase().includes(encodeURIComponent(doi).toLowerCase()),
   registryHttp:registry.status,registryExact:registered,
   markdownLength:plan.content.length});
}
console.log('THREE_SOURCE_ONLY_PREFLIGHT '+JSON.stringify(result));
if(result.some(x=>x.http!==200||!x.containsDraft||(!x.rawDoiVisible&&!x.encodedDoiVisible)||!x.registryExact))process.exitCode=2;
