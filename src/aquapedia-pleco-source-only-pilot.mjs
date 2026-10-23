/**
 * Five narrow, SOURCE-ONLY links to pre-existing Plecopedia research drafts.
 * No scientific claim, image rights or blanket release authorization implied.
 */
export const PLECO_SOURCE_ONLY_CANDIDATES=Object.freeze({
 'anc-leoni':{
  threadId:'1561146978644136089',threadName:'Ancistrus leoni — flattened 2019 species',
  doi:'10.11646/zootaxa.4552.1.1',type:'2019 taxonomic description'
 },
 'anc-patronus':{
  threadId:'1561146984935465023',threadName:'Ancistrus patronus — named paternal-care reference',
  doi:'10.11646/zootaxa.4552.1.1',type:'2019 taxonomic description'
 },
 'anc-yanesha':{
  threadId:'1561146967290150964',threadName:'L267 — Ancistrus yanesha, formerly trade L267',
  doi:'10.1111/jfb.15637',type:'taxonomic identity and historic L-number context'
 },
 'anc-l267-alias':{
  threadId:'1561146970599587851',threadName:'L267 — Historical trade code for Ancistrus yanesha',
  doi:'10.1111/jfb.15637',type:'historic trade name cross-reference'
 },
 'study-l333-captive':{
  threadId:'1561136979171610685',threadName:'Controlled research — L333 King Tiger breeding trial',
  doi:'10.1007/s10499-024-01720-z',type:'published controlled captive breeding study'
 }
});
const refuse=why=>{throw Error('Pleco source-only pilot: '+why)};
export function buildPlecoSourceOnlyPilot(records,key){
 const candidate=PLECO_SOURCE_ONLY_CANDIDATES[key];
 if(!candidate||!Array.isArray(records)||records.length!==167)refuse('invalid target or Pleco source cohort');
 const selected=records.filter(x=>x.slug===key);
 if(selected.length!==1||selected[0].group!=='pleco'||
    selected[0].url!=='/plecopedia/research/'+key+'/'||
    selected[0].status!=='Research draft — independent review pending')
  refuse('research source status or identity drift');
 const marker='[AQUAPEDIA-PLECO-RESEARCH-LINK:'+key+':20261023]';
 const pageUrl='https://aquapedia.app'+selected[0].url;
 const lines=[
  '**Plecopedia — research source index (provisional)**',
  'Aquapedia working research draft: '+pageUrl,
  'Original bibliography reference: https://doi.org/'+candidate.doi,
  'Evidence type: '+candidate.type+'.',
  'Research status: independent verification pending. Source references do not authenticate the pictured/specimen fish, genotype, origin, captive-breeding success in other aquaria, or universal care requirements.',
  'No third-party fish photographs or article text are reproduced.',
  marker
 ];
 const content=lines.join('\n');
 if(content.length>=1100||content.includes('@everyone')||content.includes('@here'))refuse('unsafe post body');
 return {...candidate,key,marker,pageUrl,content,claimsVerified:false,photos:0};
}
