export const DIRECTORY_MARKER = '[AQUAPEDIA-COUNCIL-INDEX-V1]';
const V=1024n;
const REQUIRED=[['Medaka care and strains','medaka-guides',0],['Shrimp care and strains','shrimp-guides',0],['Corydoras forum','corydoras-research',15],['Pleco forum','pleco-research',15],['Shrimp genetics','shrimp-genes',15],['Magazines and articles','magazines-and-articles',15],['Husbandry help','care-help',0]];
const OPTIONAL=[['Arowana research','arowana-research',15],['Shrimp research forum','shrimp-research',15]];
function hasView(x){return (BigInt(x||0)&V)!==0n;}
function publiclyViewable(c,p,g){let result=true;for(const x of [p,c]){const ow=(x.permission_overwrites||[]).find(o=>String(o.id)===String(g)&&(o.type===0||o.type===undefined));if(ow&&hasView(ow.deny))result=false;else if(ow&&hasView(ow.allow))result=true;}return result;}
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
   if(!publiclyViewable(matches[0],parent,guildId))throw Error('Aquapedia destination not public: '+suffix);
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
 return '/channels/'+channelId+'/pins/'+messageId;
}
