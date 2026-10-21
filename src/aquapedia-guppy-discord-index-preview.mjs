/**
 * GUARD: This module only creates a review preview from public Aquapedia
 * records. It never imports Discord REST or authorizes message publication.
 */
import {auditIkghGuppyCohort,IKGH_2023_URL} from './aquapedia-guppy-ihs-crosswalk.mjs';

export const GUPPY_FORUM_ID='1562195139353645146';
export const GUPPY_EXISTING_THREADS=[
 {key:'care',id:'1562195153211494521',name:'Guppypedia — Care and Water',page:'/guppypedia/care/'},
 {key:'standards',id:'1562195154817917080',name:'Guppypedia — Show Tail Standards',page:'/guppypedia/strains/'},
 {key:'genetics',id:'1562195157028184178',name:'Guppypedia — Genetics and Lineage',page:'/guppypedia/genetics/'},
 {key:'breeding',id:'1562195160442605688',name:'Guppypedia — Controlled Breeding',page:'/guppypedia/breeding/'},
 {key:'food',id:'1562195162464125148',name:'Guppypedia — Food and Fry',page:'/guppypedia/food/'},
 {key:'disease',id:'1562195164628389968',name:'Guppypedia — Disease Prevention',page:'/guppypedia/health/'},
 {key:'hybrid',id:'1562195167010619532',name:'Guppypedia — Endler and Hybrid Labels',page:'/guppypedia/endlers/'}
];
const reject=reason=>{throw Error('Guppy index preview: '+reason)};

function verifyThreadManifest(threads){
 if(!Array.isArray(threads)||threads.length!==GUPPY_EXISTING_THREADS.length)
  reject('expected exactly seven existing topic threads');
 const ids=new Set(),keys=new Set(),result={};
 for(const thread of threads){
  if(!thread||typeof thread.key!=='string'||keys.has(thread.key)||ids.has(thread.id))
   reject('duplicate/invalid forum thread');
  const expected=GUPPY_EXISTING_THREADS.find(x=>x.key===thread.key);
  if(!expected||thread.id!==expected.id||thread.name!==expected.name||
   thread.parentId!==GUPPY_FORUM_ID||thread.starterOwnedByBot!==true||
   thread.archived!==false||thread.locked!==false||
   typeof thread.starterContent!=='string'||
   !thread.starterContent.includes('https://aquapedia.app'+expected.page))
   reject('thread starter, parent, identity or writability not confirmed for '+thread.key);
  ids.add(thread.id);keys.add(thread.key);result[thread.key]=thread;
 }
 return result;
}
function splitIndexRows(records,section,target,heading,sourceUrl){
 const header='**REVIEW PREVIEW — '+heading+'**\n'+
  'IKGH 2023 phenotype terminology only. Not a verified pedigree, genotype, breeder origin or approval to publish.\n';
 const footer='\nPrimary show-standard source: '+sourceUrl;
 const maxLength=1900;
 const segments=[];
 let lines=[],ids=[];
 function flush(){
  if(!lines.length)return;
  const content=header+lines.join('\n')+footer;
  if(content.length>maxLength)reject('oversized Discord preview');
  segments.push({threadId:target.id,forumId:GUPPY_FORUM_ID,group:section,content,recordIds:ids,publicationAuthorized:false});
  lines=[];ids=[];
 }
 for(const r of records){
  const line='• [GUP-'+r.id+' — '+r.name+'](https://aquapedia.app/guppypedia/entries/gup-'+r.id+'/) ['+r.code+']';
  if(header.length+footer.length+lines.join('\n').length+line.length+2>maxLength)flush();
  if(header.length+footer.length+line.length>maxLength)reject('oversized individual entry');
  lines.push(line);ids.push('gup-'+r.id);
 }
 flush();
 return segments;
}

/**
 * Require real bot-owned source-linked topic starters and verified site
 * records. The output is an inert proposal, NOT an API or dispatch action.
 */
export function buildGuppyDiscordIndexPreview(records,threads,{guildActiveThreads}={}){
 if(!Number.isSafeInteger(guildActiveThreads)||guildActiveThreads<0||guildActiveThreads>=950)
  reject('no verified thread headroom');
 const destination=verifyThreadManifest(threads);
 const validated=auditIkghGuppyCohort(records,{expectFullCohort:true});
 const base=validated.records.filter(x=>x.kind==='base');
 const cover=validated.records.filter(x=>x.kind==='cover');
 const tail=validated.records.filter(x=>x.kind==='tail');
 const messages=[
  ...splitIndexRows(base,'base',destination.genetics,'Guppy body/base colors (10)',IKGH_2023_URL),
  ...splitIndexRows(cover,'cover',destination.genetics,'Guppy colors and patterns (25)',IKGH_2023_URL),
  ...splitIndexRows(tail,'tail',destination.standards,'Guppy tail forms (13)',IKGH_2023_URL)
 ];
 const allIds=messages.flatMap(x=>x.recordIds);
 if(allIds.length!==48||new Set(allIds).size!==48)
  reject('index lost or duplicated entries');
 return {publicationAuthorized:false,newThreadsToCreate:0,forumId:GUPPY_FORUM_ID,
  recordsIndexed:48,tradeRecordsHeld:validated.tradeHeld,
  groups:{base:base.length,cover:cover.length,tail:tail.length},messages};
}
