/**
 * Source-only directory entry for ten Guppy show-standard base colours.
 * No founder/trait inheritance/captive pedigree claims or licensed images.
 */
import {auditIkghGuppyCohort,IKGH_2023_URL} from './aquapedia-guppy-ihs-crosswalk.mjs';
export const GUPPY_BASE_INDEX_MARKER='[AQUAPEDIA-GUPPY-IHS-BASE:20261022]';
export const GUPPY_BASE_THREAD_ID='1562195157028184178';
const refuse=reason=>{throw Error('Guppy base index canary: '+reason)};
export function buildGuppyBaseIndexCanary(sourceRecords){
 if(!Array.isArray(sourceRecords)||sourceRecords.length!==176)refuse('unexpected source catalog');
 let audit;
 try{audit=auditIkghGuppyCohort(sourceRecords,{expectFullCohort:true});}
 catch(e){refuse('IKGH crosswalk mismatch: '+e.message);}
 const base=audit.records.filter(x=>x.kind==='base');
 if(base.length!==10||base.some((row,i)=>Number(row.id)!==i+1))
  refuse('source base-color sequence changed');
 const lines=[
  '**Guppypedia — IKGH 2023 base-color reference**',
  'Ten documented show-standard labels, linked to their Aquapedia working research records:',
  '',
  ...base.map(x=>'• [GUP-'+x.id+' — '+x.name+'](https://aquapedia.app/guppypedia/entries/gup-'+x.id+'/)'),
  '',
  'Standard: '+IKGH_2023_URL,
  'Classification reference only — not a verified pedigree, genotype, breeder origin, or independently authenticated stock.',
  'Each linked research entry retains its evidence and limitations.',
  GUPPY_BASE_INDEX_MARKER
 ];
 const content=lines.join('\n');
 if(content.length>=1500||content.includes('@everyone')||content.includes('@here'))
  refuse('unsafe or oversized reference message');
 return {
  group:'guppy',threadId:GUPPY_BASE_THREAD_ID,
  marker:GUPPY_BASE_INDEX_MARKER,recordIds:base.map(x=>'gup-'+x.id),content,
  independentLineageVerified:false,mediaAttachments:0
 };
}
