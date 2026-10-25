const MARKER=/AQUAPEDIA-MEDAKA-(?:LINEAGE-V2|CARD-V1):([a-z0-9-]+)/;
const validUrl=value=>/^https:\/\/[^\s<>"']{1,800}$/.test(String(value??''));
function limited(value,max=700){return String(value??'').replace(/@everyone|@here/gi,'@ community').slice(0,max);}
export function cardSlug(message){
 const footer=message?.embeds?.find(e=>e?.footer?.text)?.footer?.text??'';
 return (String(footer).match(MARKER)??String(message?.content??'').match(MARKER))?.[1]??null;
}
export function buildLineageCard(entry,{fileName,forumUrl,revision}={}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.slug??''))throw Error('Invalid stable tree slug');
 if(!validUrl(entry?.site_url)||!/^[a-z0-9_.-]+\.png$/i.test(fileName??''))throw Error('Invalid profile URL or image attachment');
 const sourced=Boolean(entry.source_url);
 if(sourced&&!validUrl(entry.source_url))throw Error('Original source URL must be HTTPS');
 if(forumUrl&&!validUrl(forumUrl))throw Error('Forum URL must be HTTPS');
 const status=sourced?'BREEDER / PUBLICATION REPORTED':'ANCESTRY UNKNOWN';
 const description=sourced
   ? 'Breeder-reported lineage inputs or selection history. Branches show documented accounts, **not** DNA-confirmed inheritance or individual parent-fish identity.'
   : 'Parent lines not documented. No verified original parent cross is available, so this tree intentionally shows **no ancestry connections**.';
 const fields=[];
 if(sourced){
   const names=Array.isArray(entry.parents_or_stages)?entry.parents_or_stages:[];
   fields.push({name:'🌿 Reported source lines / selection stages',
     value:names.length?names.slice(0,12).map((n,i)=>'**'+(i+1)+'.** '+limited(n,200)).join('\n').slice(0,1010):'Exact founder fish not reported',
     inline:false});
   fields.push({name:'📚 Original breeder / publication source',
      value:'['+limited(entry.source_title,145)+']('+entry.source_url+')',inline:false});
 }else {
   fields.push({name:'📂 Source status',value:'Research dossier only. An independent source establishing parentage is still needed.',inline:false});
 }
 fields.push({name:'🔎 Evidence limitations',value:limited(entry.claim_limits??'Genetic inheritance not demonstrated',900),inline:false});
 const buttons=[
   {type:2,style:5,label:'Full strain profile',url:entry.site_url},
   ...(sourced?[{type:2,style:5,label:'Original source',url:entry.source_url}]:[]),
   ...(forumUrl?[{type:2,style:5,label:'Strain discussion',url:forumUrl}]:[])
 ];
 return {
    content:'',allowed_mentions:{parse:[]},
    embeds:[{
     title:'🌿 '+limited(entry.name,210)+' • Lineage tree',
     description:description,
     color:sourced?0x4ca99f:0x8397a3,
     fields,
     image:{url:'attachment://'+fileName},
     footer:{text:'Aquapedia • '+status+' • '+limited(revision??'research',20)+' • AQUAPEDIA-MEDAKA-CARD-V1:'+entry.slug}
    }],
    components:buttons.length?[{type:1,components:buttons}]:[]
 };
}
