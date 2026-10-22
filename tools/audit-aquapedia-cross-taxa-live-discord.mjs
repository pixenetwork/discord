/**
 * Run ONLY an authenticated read-only cross-taxa Discord status audit.
 * Use existing bot credentials via --env-file=.env on the authorized host.
 * Forbidden: posting, editing, unarchiving, or using --apply.
 */
import fs from 'node:fs';
import {REST,Routes} from 'discord.js';
import {auditCrossTaxaLiveTargets} from '../src/aquapedia-cross-taxa-live-preflight.mjs';
if(process.argv.length!==3||process.argv[2]!=='--audit')
 throw Error('READ_ONLY command: require exact --audit; no --apply support');
const token=process.env.DISCORD_TOKEN;
if(!token||!process.env.AQUAPHORIA_GUILD_ID)throw Error('Authorized existing bot environment is absent');
const file='resources/aquapedia-cross-taxa-release-review-20261021.json';
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
if(manifest.publicationAuthorized!==false||manifest.proposals?.length!==99)
 throw Error('Refuse invalid or altered review manifest');
const res=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(16000)});
if(!res.ok)throw Error('Live site catalog unavailable '+res.status);
const catalog=await res.json();
const statuses={
 guppy:new Set(['Officially standardized phenotype','Trade label; lineage unverified']),
 corydoras:new Set(['Keeper observation; not a universal target','Pedigree or genetics under review']),
 pleco:new Set(['Research draft — independent review pending'])
};
const count={guppy:0,corydoras:0,pleco:0};
const paths=new Map();
for(const row of catalog){
 if(!Object.hasOwn(statuses,row.group))continue;
 if(!statuses[row.group].has(row.status))throw Error('Unexpected source status '+row.group);
 count[row.group]++;
 const url='https://aquapedia.app'+row.url;
 if(paths.has(url))throw Error('Duplicate catalog URL');
 paths.set(url,row);
}
if(count.guppy!==176||count.corydoras!==19||count.pleco!==167)
 throw Error('Cross-taxa live source cohort changed');
for(const x of manifest.proposals){
 for(const url of x.sourceUrls){
  const row=paths.get(url);
  if(!row||row.group!==x.group)throw Error('Source item missing or incorrectly grouped: '+url);
  if(x.group==='guppy'&&row.status!=='Officially standardized phenotype')
   throw Error('Blocked Guppy label changed to trade category');
 }
}
const rest=new REST({version:'10'}).setToken(token),me=await rest.get(Routes.user('@me'));
const observed=await auditCrossTaxaLiveTargets(manifest,{
 botUserId:me.id,observedAt:new Date().toISOString(),
 readThread:async id=>{
  const x=await rest.get(Routes.channel(id));
  return {id:x.id,parentId:x.parent_id,archived:x.thread_metadata?.archived,locked:x.thread_metadata?.locked};
 },
 readMessages:async id=>{
  const out=await rest.get(Routes.channelMessages(id),{query:new URLSearchParams({limit:'25'})});
  return out.map(p=>({id:p.id,authorId:p.author?.id,content:p.content??''}));
 }
});
console.log('CROSS_TAXA_LIVE_PREFLIGHT '+JSON.stringify({...observed,liveCatalogCount:catalog.length,action:'READ_ONLY'}));
