export const DIRECTORY_MARKER = '[AQUAPEDIA-COUNCIL-INDEX-V1]';
const V=1024n;
const REQUIRED=[['Medaka care and strains','medaka-guides',0],['Shrimp care and strains','shrimp-guides',0],['Corydoras forum','corydoras-research',15],['Pleco forum','pleco-research',15],['Shrimp genetics','shrimp-genes',15],['Magazines and articles','magazines-and-articles',15],['Husbandry help','care-help',0]];
const OPTIONAL=[['Arowana research','arowana-research',15],['Shrimp research forum','shrimp-research',15]];
function hasView(x){return (BigInt(x||0)&V)!==0n;}
function publiclyViewable(c,g){
 let result=true;
 const ow=(c.permission_overwrites||[]).find(o=>String(o.id)===String(g)&&(o.type===0||o.type===undefined));
 if(ow&&hasView(ow.deny))result=false;
 if(ow&&hasView(ow.allow))result=true;
 return result;
}
export function buildAquapediaDirectory({guildId,channels,roles}){
 if(!/^\d+$/.test(String(guildId))||!Array.isArray(channels)||!Array.isArray(roles))throw Error('Invalid Discord guild inventory');
 const everyone=roles.find(r=>String(r.id)===String(guildId));
 if(!everyone||!hasView(everyone.permissions))throw Error('Guild is not public');
 const categories=channels.filter(c=>c.type===4&&c.name==='📚・AQUAPEDIA');
 if(categories.length!==1)throw Error('Missing or ambiguous public Aquapedia category');
 const parent=categories[0];
 function find(suffix,type,required){
   const matches=channels.filter(c=>c.type===type&&c.parent_id===parent.id&&(c.name===suffix||c.name.endsWith('・'+suffix)));
   if(matches.length>1)throw Error('Ambiguous Aquapedia destination: '+suffix);
   if(!matches.length){if(required)throw Error('Missing Aquapedia destination: '+suffix);return null;}
   if(!publiclyViewable(matches[0],guildId))throw Error('Aquapedia destination not public: '+suffix);
   return matches[0];
 }
 const hub=find('aquapedia',0,true);
 const targets=[];
 for(const [title,suffix,type] of REQUIRED){const c=find(suffix,type,true);targets.push({title,id:c.id});}
 for(const [title,suffix,type] of OPTIONAL){const c=find(suffix,type,false);if(c)targets.push({title,id:c.id});}
 const lines=targets.map(t=>'• **'+t.title+'**: <https://discord.com/channels/'+guildId+'/'+t.id+'>');
 const content=[DIRECTORY_MARKER,'**📚 AQUAPEDIA — RESEARCH DIRECTORY**','Browse source-backed fish and shrimp research. Open a forum to search its individual posts.','',...lines,'','**Breeder and strain searches:** Use the public species guides and forums; private research and vendor workspaces are not public indexes.','**Research standards:** Verify original source, date, identity, breeding claims, award attribution, evidence confidence, and photo rights.','This is a navigation index, not a duplicate research repository.'].join('\n');
 if(content.length>2000)throw Error('Discord message would exceed length limit');
 return {hubId:hub.id,content,targets,targetIds:targets.map(x=>x.id)};
}
export function pinRoute(channelId,messageId){
 if(!channelId||!messageId)throw Error('Missing Discord pin target');
 return '/channels/'+channelId+'/messages/pins/'+messageId;
}
export async function findPinnedDirectoryMessages(request,channelId,marker=DIRECTORY_MARKER){
 if(typeof request!=='function'||!channelId)throw Error('Invalid pinned-directory lookup');
 const found=new Map();
 const seenCursors=new Set();
 let before=null,exhausted=false;
 for(let pageIndex=0;pageIndex<5;pageIndex++){
  const endpoint='/channels/'+channelId+'/messages/pins?limit=50'+(before?'&before='+encodeURIComponent(before):'');
  const page=await request('GET',endpoint);
  if(!page||!Array.isArray(page.items)||typeof page.has_more!=='boolean')throw Error('Invalid Discord pins response');
  for(const item of page.items){
   const message=item?.message;
   if(message?.id&&(message.content||'').includes(marker))found.set(String(message.id),message);
  }
  if(!page.has_more){exhausted=true;break;}
  const cursor=page.items.at(-1)?.pinned_at;
  if(!cursor||seenCursors.has(cursor))throw Error('Discord pins pagination did not advance');
  seenCursors.add(cursor);
  before=cursor;
 }
 if(!exhausted)throw Error('Discord pins exceeded verified bounded search');
 return [...found.values()];
}
export async function findDirectoryIndexPosts(request,channelId,marker=DIRECTORY_MARKER){
 const pinned=await findPinnedDirectoryMessages(request,channelId,marker);
 const recent=await request('GET','/channels/'+channelId+'/messages?limit=100');
 if(!Array.isArray(recent))throw Error('Discord message history was not verified');
 const found=new Map();
 for(const message of [...pinned,...recent]){
  if(message?.id&&(message.content||'').includes(marker))found.set(String(message.id),message);
 }
 if(found.size>1)throw Error('Duplicate canonical Aquapedia directory index messages exist');
 if(!found.size&&recent.length>=100)throw Error('Older unpinned message history is unknown; refusing duplicate directory post');
 return [...found.values()];
}

function discordSnowflake(value,label){
 const text=String(value??'');
 if(!/^[1-9]\d{0,19}$/.test(text))throw Error('Invalid Discord snowflake: '+label);
 return BigInt(text).toString();
}
export function buildDirectoryReceipt({guildId,hubId,messageId,authorId,pinned,targetIds,timestamp=new Date().toISOString()}){
 if(pinned!==true)throw Error('Discord directory receipt requires pinned readback');
 if(!Array.isArray(targetIds)||targetIds.length<1||targetIds.length>32)throw Error('Invalid Discord target snowflakes');
 const guild=discordSnowflake(guildId,'guildId');
 const hub=discordSnowflake(hubId,'hubId');
 const message=discordSnowflake(messageId,'messageId');
 const author=discordSnowflake(authorId,'authorId');
 const targets=targetIds.map((value,index)=>discordSnowflake(value,'targetIds['+index+']'));
 const checkedAt=new Date(timestamp);
 if(Number.isNaN(checkedAt.getTime()))throw Error('Invalid receipt timestamp');
 return {
  status:'verified',
  timestamp:checkedAt.toISOString(),
  guildId:guild,
  hubId:hub,
  messageId:message,
  authorId:author,
  pinned:true,
  targets,
  url:'https://discord.com/channels/'+guild+'/'+hub+'/'+message
 };
}
