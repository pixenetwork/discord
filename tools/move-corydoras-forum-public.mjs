import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GUILD='1519337502379475095';
const FORUM_ID='1560887812910350339';
const PRIVATE_CAT='1560887811962445854';
const PUBLIC_NAME='📚・AQUAPEDIA';
const NEW_NAME='🐟・corydoras-research';
const PINNED_INDEX='1560887817217904641';
const NEW_TOPIC='Public Aquapedia research forum for Corydoras species, C/CW numbered forms and captive strains. Provisional identities, histories and genetics are marked for review; photos require reuse permission.';
const RECEIPT=path.join(os.homedir(),'AppData','Local','PixelNetwork','corydoras-public-forum-move-20261017.json');
const token=process.env.DISCORD_TOKEN;
if(!token||process.env.AQUAPHORIA_GUILD_ID!==GUILD)throw new Error('Existing authorized guild/bot configuration mismatch');
const root='https://discord.com/api/v10';
async function api(uri,method='GET',body=null){
  const r=await fetch(root+uri,{method,headers:{Authorization:'Bot '+token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
  if(!r.ok){const data=(await r.text()).slice(0,240);throw new Error('Discord '+method+' '+uri+' returned '+r.status+': '+data);}
  return r.status===204?null:r.json();
}
function flag(v,index){return (BigInt(v||'0') & (1n<<BigInt(index)))!==0n;}
const categories=(await api('/guilds/'+GUILD+'/channels')).filter(c=>c.type===4&&c.name===PUBLIC_NAME);
if(categories.length!==1)throw new Error('Public Aquapedia category is not uniquely identified');
const target=categories[0];
if(target.permission_overwrites.some(o=>o.id===GUILD&&flag(o.deny,10)))throw new Error('Target Aquapedia category denies ViewChannel');
const roles=await api('/guilds/'+GUILD+'/roles');
const everyone=roles.find(r=>r.id===GUILD);
if(!everyone||!flag(everyone.permissions,10))throw new Error('The everyone role lacks guild ViewChannel');
const before=await api('/channels/'+FORUM_ID);
if(before.type!==15||![PRIVATE_CAT,target.id].includes(before.parent_id))throw new Error('Corydoras forum type/parent does not match authorized state');
if(before.name!==NEW_NAME&&before.name!=='🧬・species-and-strains')throw new Error('Unexpected forum name; refusing to move');
const guildChannels=await api('/guilds/'+GUILD+'/channels');
if(guildChannels.some(c=>c.id!==FORUM_ID&&c.name===NEW_NAME&&c.parent_id===target.id))throw new Error('Conflicting Corydoras forum in Aquapedia');
const preThread=await api('/channels/'+PINNED_INDEX);
if(preThread.parent_id!==FORUM_ID)throw new Error('Master index does not belong to the original forum');
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({mode:'audit',forumId:FORUM_ID,previousParent:before.parent_id,previousName:before.name,targetCategory:target.id,targetName:target.name,everyoneCanViewParent:true,existingForumOverwrites:before.permission_overwrites.length,wouldSetPermissionOverwrites:0,wouldRenameTo:NEW_NAME,pinnedIndexId:PINNED_INDEX}));
 process.exit(0);
}
let after=before;
const changeNeeded=before.parent_id!==target.id||before.name!==NEW_NAME||before.topic!==NEW_TOPIC||before.permission_overwrites.length!==0;
if(changeNeeded){
 after=await api('/channels/'+FORUM_ID,'PATCH',{
   parent_id:target.id,name:NEW_NAME,permission_overwrites:[],topic:NEW_TOPIC
 });
}
const verified=await api('/channels/'+FORUM_ID);
const postThread=await api('/channels/'+PINNED_INDEX);
const freshTarget=await api('/channels/'+target.id);
if(verified.parent_id!==target.id||verified.name!==NEW_NAME||verified.permission_overwrites.length!==0||verified.topic!==NEW_TOPIC||
    postThread.parent_id!==FORUM_ID||
    freshTarget.permission_overwrites.some(o=>o.id===GUILD&&flag(o.deny,10))) {
 throw new Error('Discord response failed public/parent/threads verification; inspect before retry');
}
const receipt={
  when:new Date().toISOString(),guildId:GUILD,forumId:FORUM_ID,
  previousParent:before.parent_id,parentId:verified.parent_id,parentName:freshTarget.name,
  name:verified.name,public:true,everyoneViewFromGuild:true,forumOverwriteCount:verified.permission_overwrites.length,
  preservedPinnedIndex:postThread.id,threadParentId:postThread.parent_id,verified:true,changed:changeNeeded
};
fs.mkdirSync(path.dirname(RECEIPT),{recursive:true});
fs.writeFileSync(RECEIPT,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
