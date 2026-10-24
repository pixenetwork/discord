/**
 * Direct links to four single-candidate public Cory breeding reports.
 * This indexes keeper observations only; it does NOT authenticate breeding
 * success rates, universal care parameters, pedigrees or source permissions.
 */
export const CORY_LINK_ONLY_TARGETS=Object.freeze({
 'burgessi':{slug:'hoplisoma-burgessi-breeding',anchor:'hoplisoma-burgessi',name:'Hoplisoma burgessi',threadId:'1560942081436942398'},
 'davidsandsi':{slug:'hoplisoma-davidsandsi-breeding',anchor:'hoplisoma-davidsandsi',name:'Hoplisoma davidsandsi',threadId:'1560953415230824582'},
 'nattereri':{slug:'hoplisoma-nattereri-breeding',anchor:'hoplisoma-nattereri',name:'Hoplisoma nattereri',threadId:'1560963836872360040'},
 'xinguense':{slug:'hoplisoma-xinguense-breeding',anchor:'hoplisoma-xinguense',name:'Hoplisoma xinguense',threadId:'1560966748222656554'}
});
const reject=reason=>{throw Error('Cory source-only backlink: '+reason)};
export function buildCorySourceOnlyBacklink(records,key){
 const target=CORY_LINK_ONLY_TARGETS[key];
 if(!target||!Array.isArray(records)||records.length!==19)reject('untrusted source group or target');
 const record=records.filter(r=>r.slug===target.slug);
 if(record.length!==1||record[0].name!==target.name+' breeding report'||
  record[0].group!=='corydoras'||record[0].url!=='/corydoraspedia/breeding/#'+target.anchor||
  record[0].status!=='Keeper observation; not a universal target')
  reject('live source entry/status mismatch');
 const marker='[AQUAPEDIA-CORY-REPORT-LINK:'+key+':20261022]';
 const url='https://aquapedia.app'+record[0].url;
 const content=[
  '**Corydoraspedia — research-report reference**',
  'Working report on '+target.name+': '+url,
  'Evidence status: keeper observation; source and breeding details still require independent review.',
  'Not a universal breeding parameter, verified pedigree, or authentication of captive stock.',
  'Original references are linked in the Aquapedia report; no breeder photos reproduced.',
  marker
 ].join('\n');
 if(content.length>1000||content.includes('@everyone')||content.includes('@here'))
  reject('unsafe/oversized report');
 return {key,slug:target.slug,threadId:target.threadId,threadName:target.name,
  pageUrl:url,anchor:target.anchor,content,marker,
  publicationClaimsVerified:false,photos:0};
}
