import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { BREEDING_REPORTS } from './corydoras-breeding-evidence.mjs';

const GUILD='1519337502379475095';
const CAT='1557338241903099945';
const FORUM='1560887812910350339';
const BOT='1535522109571203152';
const TITLE='BREEDING START HERE — Credited Corydoras & Fry Food Methods';
const MARKER='AQP-CORY-breeding-guide-11-v1';
const REVIEW='https://github.com/pixenetwork/aquapedia/pull/20';
const SOURCED='https://github.com/pixenetwork/aquapedia/blob/athena/corydoras-foundation-20260924/research/corydoras/2026-10-17-breeder-reports-and-fry-foods.md';
const ROOT='https://discord.com/api/v10';
const receiptsPath=path.join(os.homedir(),'AppData','Local','PixelNetwork','corydoras-research-receipts.jsonl');
const ownReceipt=path.join(os.homedir(),'AppData','Local','PixelNetwork','corydoras-breeding-guide-receipt.json');
const ID_NAMES=[
  ['434','Panda'],['473','Sterbai'],['306','Adolfoi'],['356','Duplicareum'],
  ['336','Burgessi'],['352','Davidsandsi'],['410','Metae'],['419','Nattereri'],
  ['490','Xinguense'],['253','Brochis splendens'],['488','Weitzmani']
];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function guideContent(rows){
  if(!Array.isArray(rows))throw Error('Verified source rows required');
  const links=ID_NAMES.map(([id,short])=>{
    const found=rows.filter(r=>String(r.recordKey)===id && r.kind==='directory' && r.verified===true);
    if(found.length!==1||!(/^\d{16,20}$/.test(String(found[0].threadId))))throw Error('Unverified/duplicate directory record '+id);
    return '• '+short+': <#'+found[0].threadId+'>';
  });
  if(Object.keys(BREEDING_REPORTS).length!==ID_NAMES.length)throw Error('Breeding dossier count changed');
  const msg=[
   '**CORYDORAS BREEDING / FRY FOODS — Research Start Here**',
   '**Evidence:** 11 published firsthand or specialist accounts, linked individually below. Individual tank readings are observations, not species-wide ideal ranges. Breeder of a clutch ≠ founder of a genetic strain.',
   '**Eggs:** Some species scatter eggs on glass/plants/mops, others deposit near substrate. Gentle water flow, clean shallow nurseries and removal of damaged eggs help; handling depends on adhesion.',
   '**Fry food:** Feed after yolk reserve is absorbed. Reported stages include Walter worms or microworms, then appropriately sized Artemia nauplii/soaked fine powders; later daphnia, Grindal worms and chopped foods. Remove leftovers.',
   '**Do not generalize:** Different sources report different temperatures and triggers. In one metae account Artemia/salt was only a suspected problem, not scientifically proven.',
   '**Profiles (source-linked, original bot-owned threads):**',
   ...links,
   '**Evidence dossier:** '+SOURCED,
   '**Expert review:** '+REVIEW,
   '**Rights:** Source articles and their photos remain with their authors. No photos, original-page text, invented nutrient analyses or unsupported award claims are reproduced.'
  ].join('\n');
  if(msg.length>2000)throw Error('Guide exceeds Discord 2000-character message limit: '+msg.length);
  return msg;
}

async function api(token,method,uri,body){
  for(let i=0;i<7;i++){
    const r=await fetch(ROOT+uri,{method,headers:{Authorization:'Bot '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
    if(r.status===429){
      const j=await r.json();
      await delay(Math.min(60000,Math.max(1000,Math.ceil((j.retry_after||5)*1000))));
      continue;
    }
    if(!r.ok)throw Error('Discord '+method+' '+uri+' returned '+r.status+': '+(await r.text()).slice(0,240));
    return r.status===204?null:r.json();
  }
  throw Error('Rate limit exceeded retry budget');
}

async function findByName(token){
  const active=await api(token,'GET','/guilds/'+GUILD+'/threads/active');
  const candidates=(active.threads||[]).filter(t=>t.parent_id===FORUM&&t.name===TITLE);
  let before=null;
  for(let page=0;page<25;page++){
    const route='/channels/'+FORUM+'/threads/archived/public?limit=100'+(before?'&before='+encodeURIComponent(before):'');
    const result=await api(token,'GET',route);
    const list=result.threads||[];
    candidates.push(...list.filter(t=>t.name===TITLE));
    if(!result.has_more||list.length===0)break;
    before=list[list.length-1].thread_metadata?.archive_timestamp;
    if(!before)throw Error('Missing archive cursor');
  }
  const unique=[...new Map(candidates.map(t=>[t.id,t])).values()];
  if(unique.length>1)throw Error('Multiple existing breeding guide threads; manual review required');
  return unique[0]||null;
}

async function main(){
  if(process.env.AQUAPHORIA_GUILD_ID!==GUILD)throw Error('Authorized guild mismatch');
  const token=process.env.DISCORD_TOKEN;
  if(!token)throw Error('Missing existing authorized bot credential');
  const user=await api(token,'GET','/users/@me');
  if(user.id!==BOT)throw Error('Unexpected Discord bot identity');
  const roles=await api(token,'GET','/guilds/'+GUILD+'/roles');
  if(!roles.some(r=>r.id===GUILD && (BigInt(r.permissions)&(1n<<10n))!==0n))throw Error('Guild everyone cannot view channels');
  const channels=await api(token,'GET','/guilds/'+GUILD+'/channels');
  const parent=channels.find(c=>c.id===CAT);
  const forum=channels.find(c=>c.id===FORUM);
  if(!parent||parent.name!=='📚・AQUAPEDIA'||parent.type!==4||!forum||forum.type!==15||forum.parent_id!==CAT||forum.name!=='🐟・corydoras-research')
    throw Error('Public Aquapedia forum/category invariant failed');
  if((forum.permission_overwrites||[]).length || (parent.permission_overwrites||[]).some(o=>o.id===GUILD && ((BigInt(o.deny||'0')&(1n<<10n))!==0n)))
    throw Error('Private forum/category permission override detected');
  const rows=fs.readFileSync(receiptsPath,'utf8').split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
  const message=guideContent(rows);
  const evidenceHash=createHash('sha256').update(message).digest('hex');
  const existing=await findByName(token);
  const plan={mode:process.argv.includes('--apply')?'apply':'plan',category:parent.id,forum:forum.id,existingThreadId:existing?.id||null,profileCount:ID_NAMES.length,chars:message.length};
  console.log(JSON.stringify(plan));
  if(!process.argv.includes('--apply'))return;
  let threadId,action;
  if(existing){
    const starter=await api(token,'GET','/channels/'+existing.id+'/messages/'+existing.id);
    if(starter.author.id!==BOT||!starter.embeds?.some(e=>e.footer?.text===MARKER))
      throw Error('Existing guide starter is not confirmed bot-owned with original marker');
    threadId=existing.id;
    if(starter.content===message){action='unchanged';}
    else {
      await api(token,'PATCH','/channels/'+threadId+'/messages/'+threadId,{content:message,allowed_mentions:{parse:[]}});
      action='updated';
    }
  }else{
    const required=['Breeding','Needs review'];
    const tagIds=required.map(n=>forum.available_tags?.find(t=>t.name===n)?.id);
    if(tagIds.some(x=>!x))throw Error('Breeding forum tags missing; refuse to create');
    const newThread=await api(token,'POST','/channels/'+FORUM+'/threads',{
      name:TITLE,auto_archive_duration:10080,applied_tags:tagIds,
      message:{content:message,embeds:[{title:'Corydoras breeding methods and fry feeding',description:'Eleven credited species-level published reports, with source and evidence limitations.',footer:{text:MARKER}}],allowed_mentions:{parse:[]}}
    });
    threadId=newThread.id;action='created';
  }
  const [confirmed,starter]=await Promise.all([
    api(token,'GET','/channels/'+threadId),
    api(token,'GET','/channels/'+threadId+'/messages/'+threadId)
  ]);
  if(confirmed.parent_id!==FORUM||starter.author.id!==BOT||starter.content!==message||!starter.embeds?.some(e=>e.footer?.text===MARKER))
    throw Error('Breeding guide publication readback did not verify');
  const receipt={at:new Date().toISOString(),guildId:GUILD,categoryId:CAT,forumId:FORUM,threadId,action,evidenceHash,profileCount:ID_NAMES.length,verified:true};
  fs.mkdirSync(path.dirname(ownReceipt),{recursive:true});
  fs.writeFileSync(ownReceipt,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}
if(process.argv[1] && path.resolve(fileURLToPath(import.meta.url))===path.resolve(process.argv[1])){
  main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
}
