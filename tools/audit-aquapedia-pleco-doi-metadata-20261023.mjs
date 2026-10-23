/**
 * Independent bibliographic metadata cross-check for Pleco DOI references.
 * Metadata is NOT an endorsement of biological claims or media rights.
 * Read-only external API GET; writes a new evidence JSON, never overwrites.
 */
import fs from 'node:fs';
const lane=JSON.parse(fs.readFileSync('resources/aquapedia-pleco-active-55-editorial-review-20261023.json','utf8'));
if(lane.rows?.length!==55||lane.policy?.publication_authorized===true)
 throw Error('Unexpected Pleco review cohort');
const doiMap=new Map();
for(const row of lane.rows){
 for(const ref of row.evidence){
  if(!ref.url.startsWith('https://doi.org/'))continue;
  const doi=decodeURIComponent(new URL(ref.url).pathname.slice(1));
  if(!doi.startsWith('10.')||doi.length>200)throw Error('Invalid DOI');
  if(!doiMap.has(doi.toLowerCase()))doiMap.set(doi.toLowerCase(),[]);
  doiMap.get(doi.toLowerCase()).push(row.proposal_id);
 }
}
if(doiMap.size!==24)throw Error('Cited DOI count changed: '+doiMap.size);
const entries=[...doiMap].sort(([a],[b])=>a.localeCompare(b));
const results=[];let cursor=0;
const plain=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,250);
async function crossref(doi){
 const r=await fetch('https://api.crossref.org/works/'+encodeURIComponent(doi),{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'AquapediaReview/1.0'}});
 if(!r.ok)return null;
 const o=(await r.json()).message;
 if(!o?.DOI)return null;
 return {registry:'Crossref',resolvedDoi:o.DOI.toLowerCase(),title:plain(o.title?.[0]),year:o.published?.['date-parts']?.[0]?.[0]??null,
 journal:plain(o['container-title']?.[0]),type:o.type??null,
 authorCount:Array.isArray(o.author)?o.author.length:0};
}
async function datacite(doi){
 const r=await fetch('https://api.datacite.org/dois/'+encodeURIComponent(doi),{signal:AbortSignal.timeout(12000)});
 if(!r.ok)return null;
 const o=(await r.json()).data?.attributes;
 if(!o?.doi)return null;
 return {registry:'DataCite',resolvedDoi:o.doi.toLowerCase(),title:plain(o.titles?.[0]?.title),
 year:o.publicationYear??null,journal:plain(o.publisher),
 type:o.types?.resourceTypeGeneral??null,authorCount:o.creators?.length??0};
}
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<entries.length){
  const [doi,usedBy]=entries[cursor++];
  let metadata=null,error=null;
  try{metadata=await crossref(doi);if(!metadata)metadata=await datacite(doi);}
  catch(e){error=String(e.message??e).slice(0,150);}
  const resolved=metadata?.resolvedDoi===doi;
  results.push({doi,usedBy:usedBy.toSorted(),metadataFound:!!metadata,
   registryDoiExactMatch:resolved,metadata,error,
   scientificClaimVerified:false,breedingClaimVerified:false,rightsApproved:false});
 }
}));
results.sort((a,b)=>a.doi.localeCompare(b.doi));
const counts={all:results.length,registryFound:results.filter(x=>x.metadataFound).length,
 exactRegistryMatch:results.filter(x=>x.registryDoiExactMatch).length,
 crossref:results.filter(x=>x.metadata?.registry==='Crossref').length,
 datacite:results.filter(x=>x.metadata?.registry==='DataCite').length,
 missing:results.filter(x=>!x.metadataFound).length};
const record={auditedAt:new Date().toISOString(),sourceLane:'55 active Plecopedia review-only candidates',
 bibliographyOnly:true,publishingAuthorized:false,discordWrites:0,
 counts,results};
const file='resources/aquapedia-pleco-24-doi-bibliography-20261023.json';
if(fs.existsSync(file))throw Error('Existing DOI evidence may not be overwritten');
fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('PLECO_DOI_BIBLIOGRAPHY '+JSON.stringify({counts,errors:results.filter(x=>!x.metadataFound).map(x=>({doi:x.doi,error:x.error})),
 examples:results.slice(0,5).map(x=>({doi:x.doi,title:x.metadata?.title,year:x.metadata?.year}))}));
