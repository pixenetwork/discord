import fs from 'node:fs';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const original=load('resources/aquapedia-pleco-24-doi-bibliography-20261023.json');
const repaired=load('resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json');
const lanes=load('resources/aquapedia-pleco-active-55-editorial-review-20261023.json');
if(original.results.length!==24||repaired.rows.length!==24||lanes.rows.length!==55)
 throw Error('Editorial cohort or DOI count changed');
const byDoi=new Map(repaired.rows.map(x=>[x.doi,x]));
if(byDoi.size!==24)throw Error('Duplicate DOI');
const allReferenced=new Set();
for(const record of lanes.rows){
 for(const src of record.evidence){
  if(!src.url.startsWith('https://doi.org/'))continue;
  const doi=decodeURIComponent(new URL(src.url).pathname.slice(1)).toLowerCase();
  const audit=byDoi.get(doi);
  if(!audit||!audit.usedBy.includes(record.proposal_id))throw Error('DOI crosswalk mismatch '+doi);
  allReferenced.add(doi);
 }
}
if(allReferenced.size!==24)throw Error('Missing DOI mapping');
if(repaired.rows.some(x=>!x.metadataFound||!x.registryDoiExactMatch||
 typeof x.metadata?.title!=='string'||!x.metadata.title.trim()||
 ![ 'Crossref','DataCite' ].includes(x.metadata.registry)))throw Error('Unverified registry metadata');
const referenceCount=Object.fromEntries(['Crossref','DataCite'].map(k=>[k,repaired.rows.filter(x=>x.metadata.registry===k).length]));
if(referenceCount.Crossref!==20||referenceCount.DataCite!==4)throw Error('Registry distribution changed');
const breeding=repaired.rows.filter(x=>/captive breeding/i.test(x.metadata.title));
if(breeding.length!==1||breeding[0].doi!=='10.1007/s10499-024-01720-z')
 throw Error('Breeding bibliography classification drift');
const sanitize=s=>String(s??'').replaceAll('|','\\|').replace(/\s+/g,' ').slice(0,230);
const lines=[
 '# Plecopedia independent DOI registry crosswalk — October 23, 2026',
 '',
 '> **Bibliography validated; biological claims not independently validated.** This is research evidence only. No Discord post, genealogy decision, image license or publication approval is made.',
 '',
 '- Reviewed 55 **existing, active-thread** Plecopedia article-link proposals; 29 proposals contain at least one DOI-format citation.',
 '- Found 24 unique DOI records attached to the active queue, with exact DOI identifiers independently returned by authoritative Crossref (20) or DataCite (4).',
 '- A first concurrent JavaScript request recovered 15 and left 9 API lookup gaps. A separate PowerShell registry check recovered those 9. **0 DOI identities remain unresolved in this cohort.**',
 '- **One** article explicitly addresses captive breeding of L333; the rest principally concern taxonomy, new species, revisions or treatment records. Never cite taxonomic papers as direct proof of captive breeding, founder lines or genetic inheritance.',
 '- No change to the 55 active proposed thread posts, 36 archived-thread holds, or separately held Guppy/Cory uncertain claims.',
 '',
 '| DOI | Registry | Published | Bibliographic title (shortened) | Cited by draft records |',
 '|---|---|---:|---|---|',
 ...repaired.rows.map(r=>'| ['+sanitize(r.doi)+'](https://doi.org/'+encodeURI(r.doi)+') | '+r.metadata.registry+' | '+r.metadata.year+' | '+sanitize(r.metadata.title).slice(0,100)+' | '+r.usedBy.map(x=>'\x60'+x.slice('pleco:research-article-backlink:'.length)+'\x60').join(', ')+' |'),
 '',
 '## Editorial gates still required',
 '',
 'For each cited article, check the **exact accepted species name, original description, historical trade/L-number alias**, geographic context and whether the paper supports the particular Aquapedia page claim. If a DOI exists but only establishes a species description, it must not be used to support breeder origins, inheritance mode, aquarium water parameters or captive-spawning success. Validate photographs and translations under separate licensing before any redistribution.',
 '',
 'The 55 Pleco source backlinks remain research-draft links requiring signoff. Archived forum threads must remain untouched without a separate approved procedure.',
 '',
 'Machine-checkable evidence: \x60resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json\x60 and the immutable original \x60resources/aquapedia-pleco-active-55-editorial-review-20261023.json\x60.',
 ''
];
const path='docs/operations/aquapedia-pleco-24-doi-bibliography-20261023.md';
if(fs.existsSync(path))throw Error('Evidence doc exists; version bump required');
fs.writeFileSync(path,lines.join('\n')+'\n',{flag:'wx'});
console.log('PLECO_DOI_EDITORIAL_CROSSWALK '+JSON.stringify({
doiCount:24,crossref:20,datacite:4,explicitBreedingSource:1,
indexedReviewRows:55,doiCitationRows:lanes.counts.doi_link_present,
pendingPublicationApproval:55,discordWrites:0
}));
