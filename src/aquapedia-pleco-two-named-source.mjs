/**
 * Two source-only directory backlinks to named species with original
 * descriptions documented by Eschmeyer's Catalog of Fishes.
 * L/LDA trade tags are not proof of any captive animal specimen.
 */
export const PLECO_NAMED_SOURCE_TARGETS=Object.freeze({
 'anc-claro':Object.freeze({
  threadId:'1561139086432010261',threadName:'LDA08 — Ancistrus claro',
  scientificName:'Ancistrus claro',
  originalName:'Ancistrus claro',authority:'Knaack, 1999',
  catalogUrl:'https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=65318',
  spid:'65318',
  sourceNote:'Catalog of Fishes records the 1999 Knaack description from Rio Claro in Brazil. LDA08 is an aquarium-trade identifier, NOT a test of specimen identity.'
 }),
 'pana-nocturnus':Object.freeze({
  threadId:'1561147036588318821',threadName:'L329 — Panaqolus nocturnus',
  scientificName:'Panaqolus nocturnus',
  originalName:'Panaque nocturnus',authority:'Schaefer & Stewart, 1993',
  catalogUrl:'https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=62021',
  spid:'62021',
  sourceNote:'Catalog of Fishes records the 1993 description under Panaque nocturnus and the current combination Panaqolus nocturnus. L329 is a trade code, not a fish authentication.'
 })
});
const fail=s=>{throw Error('Pleco named-source directory: '+s)};
export function buildPlecoNamedSourceIndex(catalog,key){
 const target=PLECO_NAMED_SOURCE_TARGETS[key];
 if(!target||!Array.isArray(catalog)||catalog.length!==167)fail('invalid source cohort or named species');
 const matches=catalog.filter(x=>x.group==='pleco'&&x.slug===key);
 if(matches.length!==1||matches[0].status!=='Research draft — independent review pending'||
   matches[0].url!=='/plecopedia/research/'+key+'/')
   fail('source identity/review-pending status changed');
 const pageUrl='https://aquapedia.app'+matches[0].url;
 const marker='[AQUAPEDIA-PLECO-NAMED-INDEX:'+key+':20261023]';
 const content=[
  '**Plecopedia — named-species source directory (research draft)**',
  'Aquapedia working entry: '+pageUrl,
  'Scientific name: *'+target.scientificName+'*. Original description: *'+target.originalName+'* ('+target.authority+').',
  'Species record: '+target.catalogUrl,
  target.sourceNote,
  'Reference status: descriptive bibliography only. No aquarium fish, breeder provenance, captive-spawning rate, genotype, or pedigree is authenticated; original photos/text are not copied.',
  marker
 ].join('\n');
 if(content.length>=1350||content.includes('@everyone')||content.includes('@here'))fail('unsafe message');
 return {key,...target,pageUrl,content,marker,photoCount:0,claimsVerified:false};
}
