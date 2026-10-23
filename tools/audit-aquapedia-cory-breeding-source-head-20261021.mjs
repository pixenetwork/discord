/**
 * Verify reachability of the ten original Cory breeding-report links with
 * HEAD requests only. Do not download/reproduce third-party report content.
 */
import fs from 'node:fs';
const ledger=JSON.parse(fs.readFileSync('resources/aquapedia-cross-taxa-citation-presence-20261021.json','utf8'));
const cory=ledger.records.filter(row=>row.url.startsWith('https://aquapedia.app/corydoraspedia/'));
if(cory.length!==10||cory.some(row=>row.sourceScope!=='anchor-local'||row.links.length!==1))
 throw Error('Cory evidence changed; refuse stale HEAD audit');
const urls=[...new Set(cory.flatMap(row=>row.links))].sort((a,b)=>a.localeCompare(b));
if(urls.length!==10)throw Error('Expected 10 original report links');
const result=[];let cursor=0;
await Promise.all(Array.from({length:3},async()=>{
 while(cursor<urls.length){
  const url=urls[cursor++];
  try{
   const r=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(12000)});
   result.push({url,status:r.status,finalUrl:r.url,headAccessible:r.status>=200&&r.status<400,error:null});
  }catch(e){
   result.push({url,status:null,finalUrl:null,headAccessible:false,error:String(e?.message||e).slice(0,150)});
  }
 }
}));
result.sort((a,b)=>a.url.localeCompare(b.url));
const status={
 capturedAt:new Date().toISOString(),method:'HTTP HEAD ONLY, no PDF/content download',
 checked:result.length,reachableByHead:result.filter(x=>x.headAccessible).length,
 sourceLinks:result,claimVerified:false,contentVerified:false,rightsVerified:false,
 discordWrites:0,publicationAuthorized:false
};
const file='resources/aquapedia-cory-breeding-source-head-20261021.json';
if(fs.existsSync(file))throw Error('Snapshot already exists; version bump instead of silent overwrite');
fs.writeFileSync(file,JSON.stringify(status,null,2)+'\n',{flag:'wx'});
console.log('CORY_ORIGINAL_REFERENCE_HEAD '+JSON.stringify({
 checked:status.checked,reachable:status.reachableByHead,
 unsuccessful:result.filter(x=>!x.headAccessible).map(x=>({url:x.url,status:x.status,error:x.error})),
 claimsVerified:false,discordWrites:0
}));
