/**
 * Source-only links for the remaining IKGH 2023 Guppy show labels.
 * Recognized phenotype labels are NOT genetic lineages.
 */
import {auditIkghGuppyCohort,IKGH_2023_URL} from './aquapedia-guppy-ihs-crosswalk.mjs';
export const GUPPY_REMAINING_TOPIC_SPECS=Object.freeze({
 'cover-one':{kind:'cover',start:11,end:29,title:'Colors and patterns (part 1)',threadId:'1562195157028184178',threadName:'Guppypedia — Genetics and Lineage'},
 'cover-two':{kind:'cover',start:30,end:35,title:'Colors and patterns (part 2)',threadId:'1562195157028184178',threadName:'Guppypedia — Genetics and Lineage'},
 'tail':{kind:'tail',start:36,end:48,title:'Tail-form standards',threadId:'1562195154817917080',threadName:'Guppypedia — Show Tail Standards'}
});
const reject=reason=>{throw Error('Remaining Guppy index: '+reason)};
export function buildRemainingGuppyIndex(records,topic){
 const spec=GUPPY_REMAINING_TOPIC_SPECS[topic];
 if(!spec||!Array.isArray(records)||records.length!==176)reject('unrecognized topic or source catalog');
 let verified;
 try{verified=auditIkghGuppyCohort(records,{expectFullCohort:true});}
 catch(e){reject('IKGH source identity changed: '+e.message);}
 const rows=verified.records.filter(x=>Number(x.id)>=spec.start&&Number(x.id)<=spec.end);
 if(rows.length!==spec.end-spec.start+1||
    rows.some((x,i)=>Number(x.id)!==spec.start+i||x.kind!==spec.kind))reject('source trait numbers not contiguous');
 const marker='[AQUAPEDIA-GUPPY-IKGH:'+topic+':20261022]';
 const entryUrls=rows.map(x=>'https://aquapedia.app/guppypedia/entries/gup-'+x.id+'/');
 const content=[
  '**Guppypedia — IKGH 2023 '+spec.title+'**',
  'Show-standard phenotype terminology; links to working Aquapedia research records:',
  '',
  ...rows.map((x,i)=>'• [GUP-'+x.id+' — '+x.name+']('+entryUrls[i]+')'),
  '',
  'Primary standard: '+IKGH_2023_URL,
  'Classification only — not a verified pedigree, genotype, original breeder, or authenticated stock.',
  'Commercial/trade lines remain separate and unverified.',
  marker
 ].join('\n');
 if(content.length>1900||content.length<200||content.includes('@everyone')||content.includes('@here'))
  reject('unsafe or oversized final message');
 return {topic,threadId:spec.threadId,threadName:spec.threadName,marker,content,entryUrls,
  idRange:[spec.start,spec.end],claimVerified:false,photos:0};
}
