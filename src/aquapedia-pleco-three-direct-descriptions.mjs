/**
 * Only direct description DOI source links for three previously vetted
 * Plecopedia research drafts. A scientific paper is NOT authenticated
 * aquarium stock, inheritance, breeder origin or media permission.
 */
export const PLECO_THREE_DIRECT_DESCRIPTIONS=Object.freeze({
 'hyp-contradens':{
  threadId:'1561139081063174268',
  threadName:'Hypancistrus contradens — not official L201a',
  doi:'10.1643/0045-8511(2007)7[62:fnhslf]2.0.co;2',
  topic:'Original 2007 species description'
 },
 'hyp-parkateje':{
  threadId:'1561146973275426817',
  threadName:'Hypancistrus parkateje — Tocantins 2025',
  doi:'10.1111/jfb.15971',
  topic:'Original Rio Tocantins species description'
 },
 'pseudo-sidereus':{
  threadId:'1561174493689548871',
  threadName:'Pseudancistrus sidereus — generic-placement dispute',
  doi:'10.11646/zootaxa.628.1.1',
  topic:'Original 2004 taxonomic description; subsequent generic placement requires separate review'
 }
});
const fail=s=>{throw Error('Pleco three-direct-source plan: '+s)};
export function buildPlecoThreeDirectSourceIndex(catalog,key){
 const spec=PLECO_THREE_DIRECT_DESCRIPTIONS[key];
 if(!spec||!Array.isArray(catalog)||catalog.length!==167)fail('untrusted source cohort or target');
 const row=catalog.filter(x=>x.group==='pleco'&&x.slug===key);
 if(row.length!==1||row[0].status!=='Research draft — independent review pending'||
    row[0].url!=='/plecopedia/research/'+key+'/')fail('article identity or research status changed');
 const pageUrl='https://aquapedia.app'+row[0].url;
 const marker='[AQUAPEDIA-PLECO-DIRECT-DESCRIPTION:'+key+':20261023]';
 const doiUrl='https://doi.org/'+encodeURIComponent(spec.doi);
 const content=[
  '**Plecopedia — original scientific description (provisional research index)**',
  'Aquapedia working research draft: '+pageUrl,
  'Original publication DOI: '+doiUrl,
  'Citation scope: '+spec.topic+'.',
  'The cited work describes a named taxon; it does not authenticate trade-name L-number assignments, aquarium specimens, breeder pedigrees, inheritance, captive reproduction, or universal care requirements.',
  'Independent claim review remains pending. No third-party images or copyrighted article text are reproduced.',
  marker
 ].join('\n');
 if(content.length>1300||content.includes('@everyone')||content.includes('@here'))
   fail('unsafe text or message length');
 return {key,...spec,sourceUrl:pageUrl,pageUrl,doiUrl,marker,content,
  claimVerified:false,specimenAuthenticated:false,photos:0};
}
