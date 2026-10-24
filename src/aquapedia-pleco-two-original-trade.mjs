/**
 * Source-only original taxon/trade-reference links for TWO existing public
 * bot-owned threads. Does not certify any fish specimen or genetics.
 */
export const PLECO_TWO_ORIGINAL_TRADE=Object.freeze({
 l239:Object.freeze({
  threadId:'1560955932400427049',
  threadName:'L239 — Blue Panaque is actually Baryancistrus',
  doi:'10.1643/ci-07-187',
  name:'Baryancistrus beggini',
  originalYear:2009,
  sourceType:'Original 2009 species description explicitly mentioning trade L239'
 }),
 l398:Object.freeze({
  threadId:'1560964997721489449',
  threadName:'L398 — Tanke Tiger Pleco, described species',
  doi:'10.1371/journal.pone.0165388',
  name:'Panaqolus tankei',
  originalYear:2016,
  sourceType:'Original 2016 species description explicitly citing the L398 aquarium designation'
 })
});
const fail=s=>{throw Error('Pleco two original-trade source: '+s)};
export function buildPlecoOriginalTradeIndex(records,key){
 const p=PLECO_TWO_ORIGINAL_TRADE[key];
 if(!p||!Array.isArray(records)||records.length!==167)fail('wrong research cohort or name');
 const rows=records.filter(x=>x.slug===key&&x.group==='pleco');
 if(rows.length!==1||rows[0].status!=='Research draft — independent review pending'||
    rows[0].url!=='/plecopedia/research/'+key+'/')
   fail('public research status or identity changed');
 const pageUrl='https://aquapedia.app'+rows[0].url;
 const marker='[AQUAPEDIA-PLECO-ORIGINAL-TRADE:'+key+':20261024]';
 const content=[
  '**Plecopedia — original scientific species-description reference (research draft)**',
  'Aquapedia provisional article: '+pageUrl,
  'Named species: *'+p.name+'*. '+p.sourceType+'.',
  'Original scientific publication: https://doi.org/'+p.doi,
  'The original paper links a historical L-number with a scientifically described taxon. It does NOT authenticate any individual fish, exporter, geographic stock origin, breeding genealogy, inherited traits, or universal care advice.',
  'No scientific images or article text are reproduced. Independent Aquapedia claim review remains pending.',
  marker
 ].join('\n');
 if(content.length>=1200||content.includes('@everyone')||content.includes('@here'))fail('unsafe post length or mention');
 return {...p,key,pageUrl,marker,content,attachments:0,liveSpecimenVerified:false,breedingPedigreeVerified:false};
}
