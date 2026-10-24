import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const local=path.join(os.homedir(),'.pixelnetwork','discord','receipts');
const source=path.resolve(process.env.DISCORD_COUNCIL_SNAPSHOT_PATH||path.join(local,'discord-council-prechange-20261017.json'));
const output=path.resolve(process.env.DISCORD_COUNCIL_ALIAS_RECEIPT_PATH||path.join(local,'discord-council-legacy-alias-inventory-20261017.json'));
// Compare resolved filesystem identity, not only path spellings: Windows path
// case, hardlinks and symlinks must never let a report overwrite its input.
const sourceIdentity=fs.statSync(source);
if(fs.existsSync(output)) {
 const outputIdentity=fs.statSync(output);
 if(sourceIdentity.dev===outputIdentity.dev && sourceIdentity.ino===outputIdentity.ino)
   throw Error('Snapshot input and evidence output must be different files');
}
const snap=JSON.parse(fs.readFileSync(source,'utf8'));
if(!snap||!Array.isArray(snap.channels)||!/^\d+$/.test(String(snap.id||'')))throw Error('Malformed historical Discord guild snapshot');
const hold=snap.channels.filter(x=>x.type===4 && x.name.includes('MIGRATION HOLD'));
if(hold.length!==1)throw Error('Missing or ambiguous historic private hold');
const guild=String(snap.id);
const everyoneDeny=c=>{
 const ow=(c.permission_overwrites||[]).find(x=>String(x.id)===guild&&(x.type===0||x.type===undefined));
 return Boolean(ow&&(BigInt(ow.deny||0)&1024n)!==0n&&(BigInt(ow.allow||0)&1024n)===0n);
};
if(!everyoneDeny(hold[0]))throw Error('Private migration hold was not privacy-verified');
const children=snap.channels.filter(x=>String(x.parent_id)===String(hold[0].id));
if(children.length!==31||new Set(children.map(x=>String(x.id))).size!==31)throw Error('Incomplete or duplicated historic Migration Hold channel census');
for(const c of children)if(!everyoneDeny(c))throw Error('Migration Hold child lacks a verified @everyone VIEW_CHANNEL deny: '+String(c.id));
const normalize=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g,'');
const entries=children.map(c=>({
 id:c.id,name:c.name,key:normalize(c.name),
 url:'https://discord.com/channels/'+guild+'/'+c.id,
 position:c.position,lastMessageId:c.last_message_id,privateChannelVerified:true
})).sort((a,b)=>a.name.localeCompare(b.name));
const families=new Map();
for(const e of entries){const k=e.key;if(!families.has(k))families.set(k,[]);families.get(k).push({id:e.id,name:e.name});}
const duplicateGroups=[...families.values()].filter(x=>x.length>1);
const report={status:'read_only',capturedAt:new Date().toISOString(),sourceSnapshot:snap.when,guild,category:hold[0].name,channelCount:entries.length,entries,confirmedExactNameCollisions:duplicateGroups,decision:'No channel moved, renamed, or deleted. Similar but nonidentical lineage/trade names need breeder-source reconciliation.'};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log('ALIAS_INVENTORY '+JSON.stringify({count:report.channelCount,collisionGroups:duplicateGroups,allNames:entries.map(x=>x.name),path:output}));
