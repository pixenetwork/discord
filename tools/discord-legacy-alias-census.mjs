import fs from 'node:fs';
import path from 'node:path';
const V=1024n;
const source=process.env.AQUAPEDIA_SNAPSHOT_PATH||path.resolve('data','discord-council-prechange-20261017.json');
const output=process.env.AQUAPEDIA_ALIAS_INVENTORY_PATH||path.resolve('data','discord-council-legacy-alias-inventory-20261017.json');
const expectedCount=Number(process.env.AQUAPEDIA_MIGRATION_HOLD_EXPECTED_COUNT||31);
if(!Number.isInteger(expectedCount)||expectedCount<1)throw Error('Invalid expected Migration Hold channel count');
const snap=JSON.parse(fs.readFileSync(source,'utf8'));
const hold=snap.channels.filter(x=>x.type===4 && x.name.includes('MIGRATION HOLD'));
if(hold.length!==1)throw Error('Missing or ambiguous historic private hold');
const guild=snap.id;
const hasView=x=>(BigInt(x||0)&V)!==0n;
const everyone=(snap.roles||[]).find(x=>String(x.id)===String(guild));
if(!everyone||!hasView(everyone.permissions))throw Error('Snapshot does not prove baseline @everyone ViewChannel');
const parentOverwrite=(hold[0].permission_overwrites||[]).find(x=>String(x.id)===String(guild));
if(!parentOverwrite||!hasView(parentOverwrite.deny))throw Error('Private migration hold category was not privacy-verified');
const children=snap.channels.filter(x=>x.parent_id===hold[0].id);
if(children.length!==expectedCount)throw Error('Migration Hold census incomplete: expected '+expectedCount+' channels, found '+children.length);
function visibleToEveryone(channel){
 let visible=hasView(everyone.permissions);
 const ow=(channel.permission_overwrites||[]).find(x=>String(x.id)===String(guild)&&(x.type===0||x.type===undefined));
 if(ow&&hasView(ow.deny))visible=false;
 if(ow&&hasView(ow.allow))visible=true;
 return visible;
}
for(const child of children){
 if(visibleToEveryone(child))throw Error('Migration Hold child not private: '+child.id);
}
const normalize=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g,'');
const entries=children.map(c=>({id:c.id,name:c.name,key:normalize(c.name),url:'https://discord.com/channels/'+guild+'/'+c.id,position:c.position,lastMessageId:c.last_message_id,privateChannelVerified:true})).sort((a,b)=>a.name.localeCompare(b.name));
const families=new Map();
for(const e of entries){const k=e.key;if(!families.has(k))families.set(k,[]);families.get(k).push({id:e.id,name:e.name});}
const duplicateGroups=[...families.values()].filter(x=>x.length>1);
const report={status:'read_only',capturedAt:new Date().toISOString(),sourceSnapshot:snap.when,guild,category:hold[0].name,channelCount:entries.length,entries,confirmedExactNameCollisions:duplicateGroups,decision:'No channel moved, renamed, or deleted. Similar but nonidentical lineage/trade names need breeder-source reconciliation.'};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log('ALIAS_INVENTORY '+JSON.stringify({count:report.channelCount,collisionGroups:duplicateGroups,allNames:entries.map(x=>x.name),path:output}));
