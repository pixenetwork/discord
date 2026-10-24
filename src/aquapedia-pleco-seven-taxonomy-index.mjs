/**
 * Seven reviewed literature-index links, strictly to original Pleco research
 * draft source URLs. Bibliographic identity != specimen/authenticity proof.
 */
export const PLECO_TAXONOMY_SOURCE_LINKS=Object.freeze({
 'bary-hadrostomus':{threadId:'1561139039829229641',threadName:'Baryancistrus hadrostomus — Jari River',doi:'10.1643/ci-19-201'},
 'bary-micropunctatus':{threadId:'1561139043067101295',threadName:'Baryancistrus micropunctatus — Jari River',doi:'10.1643/ci-19-201'},
 'hyp-margaritatus':{threadId:'1561147013100470355',threadName:'Hypancistrus margaritatus — Takutu spot pattern',doi:'10.3897/zookeys.552.5956'},
 'hyp-phantasma':{threadId:'1561147010076123231',threadName:'Hypancistrus phantasma — archival Rio Uaupés',doi:'10.3897/zookeys.552.5956'},
 'pana-orcesi':{threadId:'1561174414156890224',threadName:'Panaqolus orcesi — Napo basin 2024',doi:'10.11646/zootaxa.5463.1.7'},
 'pana-pantostiktos':{threadId:'1561174416778465311',threadName:'Panaqolus pantostiktos — Tigre basin 2024',doi:'10.11646/zootaxa.5463.1.7'},
 'peckol-lujani':{threadId:'1561139054697775215',threadName:'Peckoltia lujani — Orinoco (2015)',doi:'10.3897/zookeys.480.6540'}
});
const fail=s=>{throw Error('Pleco taxonomy source index: '+s)};
export function buildPlecoTaxonomySourceIndex(catalog,key){
 const target=PLECO_TAXONOMY_SOURCE_LINKS[key];
 if(!target||!Array.isArray(catalog)||catalog.length!==167)fail('wrong source cohort/target');
 const row=catalog.filter(x=>x.group==='pleco'&&x.slug===key);
 if(row.length!==1||row[0].status!=='Research draft — independent review pending'||
   row[0].url!=='/plecopedia/research/'+key+'/')fail('article identity/status has changed');
 const sourceUrl='https://aquapedia.app'+row[0].url;
 const marker='[AQUAPEDIA-PLECO-TAXONOMY-INDEX:'+key+':20261023]';
 const content=[
  '**Plecopedia — provisional taxonomy source index**',
  'Aquapedia working research draft: '+sourceUrl,
  'Published description/revision reference: https://doi.org/'+target.doi,
  'Bibliography only. Source naming is not an authentication of aquarium specimens, breeder ancestry, inheritance, captive reproduction, or universal husbandry.',
  'Independent article-level review remains pending; no third-party images or article text are reproduced.',
  marker
 ].join('\n');
 if(content.length>=1100||content.includes('@everyone')||content.includes('@here'))fail('unsafe source-only message');
 return {key,...target,sourceUrl,pageUrl:sourceUrl,marker,content,mediaAttachments:0,
  taxonomyClaimVerified:false,geneticLineageVerified:false};
}
