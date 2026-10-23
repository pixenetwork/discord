import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildAquapediaDirectory,pinRoute,findDirectoryIndexPosts} from '../src/aquapedia-directory.mjs';

const guild=process.env.AQUAPHORIA_GUILD_ID,token=process.env.DISCORD_TOKEN;
if(!guild||!token)throw Error('Missing authorized Discord bot runtime environment');
const applying=process.argv.includes('--apply');
if(applying&&process.env.AQUAPEDIA_DIRECTORY_APPROVED!=='20261017')throw Error('Explicit guarded apply authorization missing');
// Fail before network writes if the protected local receipt destination is invalid.
const output=path.resolve(process.env.AQUAPEDIA_DIRECTORY_RECEIPT_PATH||path.join(os.homedir(),'.pixelnetwork','discord','receipts','discord-council-index-receipt-20261017.json'));
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(output.startsWith(repo+path.sep))throw Error('Receipt must not be written inside the source checkout');
if(applying)fs.mkdirSync(path.dirname(output),{recursive:true});
const base='https://discord.com/api/v10';
async function request(method,endpoint,body){
 const res=await fetch(base+endpoint,{
  method,
  headers:{Authorization:'Bot '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!res.ok)throw Error(method+' '+endpoint+' returned HTTP '+res.status);
 return res.status===204?null:res.json();
}
const [channels,roles,bot]=await Promise.all([
 request('GET','/guilds/'+guild+'/channels'),request('GET','/guilds/'+guild+'/roles'),request('GET','/users/@me')
]);
const plan=buildAquapediaDirectory({guildId:guild,channels,roles});
const prior=await findDirectoryIndexPosts(request,plan.hubId);
if(prior.length>1)throw Error('Duplicate index posts exist; refusing another write');
if(prior.length===1&&String(prior[0].author.id)!==String(bot.id))throw Error('Index marker owned by another author');
console.log('PREFLIGHT '+JSON.stringify({guild,channel:plan.hubId,targets:plan.targets,oldPosts:prior.length,dryRun:!applying,plannedLength:plan.content.length}));
if(!applying){console.log('PREVIEW\n'+plan.content);process.exit(0);}
let post;
const endpoint='/channels/'+plan.hubId+'/messages';
if(prior.length){
 const old=prior[0];
 if(old.content===plan.content)post=old;
 else post=await request('PATCH',endpoint+'/'+old.id,{content:plan.content,allowed_mentions:{parse:[]}});
}else{
 post=await request('POST',endpoint,{content:plan.content,allowed_mentions:{parse:[]}});
}
if(!post||!post.id||String(post.author?.id)!==String(bot.id))throw Error('Bot-owned index message not verified after write');
let read=await request('GET',endpoint+'/'+post.id);
if(read.content!==plan.content || String(read.author?.id)!==String(bot.id))throw Error('Exact-content Discord readback failed');
if(!read.pinned)await request('PUT',pinRoute(plan.hubId,post.id));
read=await request('GET',endpoint+'/'+post.id);
if(!read.pinned||read.content!==plan.content)throw Error('Pinned index verification failed');
const receipt={status:'verified',timestamp:new Date().toISOString(),guildId:guild,hubId:plan.hubId,messageId:read.id,authorId:read.author.id,pinned:read.pinned,targets:plan.targets.map(x=>x.id),url:'https://discord.com/channels/'+guild+'/'+plan.hubId+'/'+read.id};
fs.writeFileSync(output,JSON.stringify(receipt,null,2));
console.log('VERIFIED '+JSON.stringify(receipt));
