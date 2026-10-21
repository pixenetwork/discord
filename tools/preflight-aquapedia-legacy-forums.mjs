import {REST,Routes} from 'discord.js';
import {assessLegacyForums,LEGACY_FORUMS} from '../src/aquapedia-duplicate-preflight.mjs';
// Authenticated GET-only preflight. No write/rename/delete endpoints are reachable here.
const guildId=process.env.AQUAPHORIA_GUILD_ID;
if (guildId!=='1519337502379475095' || !process.env.DISCORD_TOKEN) throw Error('Expected authorized bot identity and guild');
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
const dirs=[
  ['1557338242548764692','1561431117028921445'],
  ['1519337502379475097','1561478143049597000'],
  ['1561465436305104917','1561465436305104917'],
  ['1561465440473972770','1561465440473972770'],
  ['1561466245633810472','1561466248313962588'],
  ['1561466639533346949','1561466643643764831']
];
const [channels,activeResult]=await Promise.all([
  rest.get(Routes.guildChannels(guildId)),
  rest.get(Routes.guildActiveThreads(guildId)),
]);
const archivedById={};
for (const f of LEGACY_FORUMS) {
  try {
    const result=await rest.get('/channels/'+f.id+'/threads/archived/public',{query:new URLSearchParams({limit:'100'})});
    archivedById[f.id]={count:result.threads?.length??0,hasMore:result.has_more!==false};
  } catch(err) {
    archivedById[f.id]={count:null,hasMore:true,error:String(err.message).slice(0,100)};
  }
}
const directories=[];
for(const [channel,message] of dirs){
  try {
    const record=await rest.get(Routes.channelMessage(channel,message));
    directories.push({id:record.id,content:record.content});
  } catch(err) { directories.push({id:null,error:String(err.message).slice(0,100)}); }
}
const report=assessLegacyForums({guildId,channels,activeThreads:activeResult.threads,archivedById,directories});
console.log('AQUAPEDIA_LEGACY_FORUM_PREFLIGHT '+JSON.stringify({checkedAt:new Date().toISOString(),...report}));
if(report.status!=='PREFLIGHT_OK')process.exitCode=1;
