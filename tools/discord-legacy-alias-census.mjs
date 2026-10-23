import fs from 'node:fs';
const source='C:/Users/duy/.jarvis-worktrees/discord-d2-recovery-20261002/data/discord-council-prechange-20261017.json';
const snap=JSON.parse(fs.readFileSync(source,'utf8'));
const hold=snap.channels.filter(x=>x.type===4 && x.name.includes('MIGRATION HOLD'));
if(hold.length!==1)throw Error('Missing or ambiguous historic private hold');
const guild=snap.id;
const ow=(hold[0].permission_overwrites||[]).find(x=>x.id===guild);
if(!ow||(BigInt(ow.deny||0)&1024n)===0n)throw Error('Private migration hold was not privacy-verified');
const normalize=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g,'');
const entries=snap.channels.filter(x=>x.parent_id===hold[0].id).map(c=>({id:c.id,name:c.name,key:normalize(c.name),url:'https://discord.com/channels/'+guild+'/'+c.id,position:c.position,lastMessageId:c.last_message_id,privateParentVerified:true})).sort((a,b)=>a.name.localeCompare(b.name));
const families=new Map();
for(const e of entries){const k=e.key;if(!families.has(k))families.set(k,[]);families.get(k).push({id:e.id,name:e.name});}
const duplicateGroups=[...families.values()].filter(x=>x.length>1);
const report={status:'read_only',capturedAt:new Date().toISOString(),sourceSnapshot:snap.when,guild,category:hold[0].name,channelCount:entries.length,entries,confirmedExactNameCollisions:duplicateGroups,decision:'No channel moved, renamed, or deleted. Similar but nonidentical lineage/trade names need breeder-source reconciliation.'};
const output='C:/Users/duy/.jarvis-worktrees/discord-d2-recovery-20261002/data/discord-council-legacy-alias-inventory-20261017.json';
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log('ALIAS_INVENTORY '+JSON.stringify({count:report.channelCount,collisionGroups:duplicateGroups,allNames:entries.map(x=>x.name),path:output}));
