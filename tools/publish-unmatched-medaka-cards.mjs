// One-off completion pass for research-backed Medaka cards absent from V2 receipts.
// Fail closed on possible orphan/duplicate messages. Never run beside the in-place editor.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
import {extractLineageSvg,validateLineageManifest} from '../src/medaka-lineage-publisher.mjs';
import {buildLineageCard,cardSlug} from '../src/medaka-lineage-card.mjs';
const GUILD='1519337502379475095', INDEX='1563764327037669416',FORUM='1561189286399705128',CAT='1561430495680667719';
const A='D:\\PixelNetwork\\aquapedia-lineage-export-20261024', B='D:\\PixelNetwork\\discord-lineage-sync-20261024';
const R=path.join(B,'reports'),LEDGER=path.join(R,'medaka-lineage-new-card-receipts.json'),LOCK=path.join(R,'medaka-lineage-new-card.lock');
const token=process.env.DISCORD_TOKEN,apply=process.argv.includes('--apply')&&process.argv.includes('--owner-approved-publication');
const limit=Number(process.argv.find(s=>s.startsWith('--limit='))?.slice(8)??26);
if(!Number.isInteger(limit)||limit<1||limit>26||!token||process.env.AQUAPHORIA_GUILD_ID!==GUILD)throw Error('Invalid authorization or range');
const manifest=JSON.parse(fs.readFileSync(path.join(A,'resources','medaka-discord-lineage-manifest.json'),'utf8'));
const receipts=JSON.parse(fs.readFileSync(path.join(R,'medaka-lineage-sync-receipts.json'),'utf8'));
validateLineageManifest(manifest);
if(manifest.aquapedia_commit!==receipts.aquapediaHead||receipts.guildId!==GUILD||receipts.channelId!==INDEX)throw Error('Baseline mismatch');
const aquaHead=execFileSync('git',['-C',A,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[0-9a-f]{40}$/.test(process.env.AQUAPEDIA_LINEAGE_RENDERER_HEAD??'')||aquaHead!==process.env.AQUAPEDIA_LINEAGE_RENDERER_HEAD)throw Error('Explicit approved Aquapedia renderer HEAD required; fail closed');
const missing=manifest.trees.filter(e=>!Object.hasOwn(receipts.records,e.slug));
const ledger=fs.existsSync(LEDGER)?JSON.parse(fs.readFileSync(LEDGER,'utf8')):{schemaVersion:1,sourceHead:aquaHead,records:{},errors:[]};
if(ledger.sourceHead!==aquaHead)throw Error('Ledger source changed');
const save=()=>{const p=LEDGER+'.tmp-'+process.pid;fs.writeFileSync(p,JSON.stringify(ledger,null,2)+'\n');fs.renameSync(p,LEDGER);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(endpoint,method='GET',body=null){
 for(let i=0;i<6;i++){
  const res=await fetch('https://discord.com/api/v10'+endpoint,{
   method,headers:{Authorization:'Bot '+token,...(body&&! (body instanceof FormData)?{'Content-Type':'application/json'}:{})},
   body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(30000)
  });
  const out=await res.json().catch(()=>({}));
  if(res.status===429){await sleep(Math.min(60000,Number(out.retry_after??2)*1000+350));continue;}
  if(res.status>=500&&i<5){await sleep(700*(i+1));continue;}
  if(!res.ok)throw Error(method+' '+endpoint+' HTTP '+res.status+' '+String(out.message??''));
  return out;
 }
 throw Error('Retries exceeded');
}
const png=e=>{
 const html=fs.readFileSync(path.join(A,'site','medakapedia','strains',e.slug,'index.html'),'utf8');
 const rendered=new Resvg(extractLineageSvg(html),{fitTo:{mode:'width',value:1500}}).render().asPng();
 if(rendered.length<1000||rendered.length>7000000)throw Error('Bad image '+e.slug);
 return rendered;
};
const name=e=>'aquapedia-medaka-'+e.slug+'-picture-gene-tree.png';
function form(e,threadId,picture){
 const file=name(e),card=buildLineageCard(e,{fileName:file,forumUrl:'https://discord.com/channels/'+GUILD+'/'+threadId,revision:manifest.aquapedia_commit.slice(0,12)});
 const f=new FormData();
 f.append('payload_json',JSON.stringify({...card,attachments:[{id:0,filename:file,description:'Aquapedia horizontal lineage with source links and confidence status'}]}));
 f.append('files[0]',new Blob([picture],{type:'image/png'}),file);
 return f;
}
function assertCard(m,e){
 if(m.author?.id!==bot.id||cardSlug(m)!==e.slug||!m.embeds?.[0]?.image?.url?.includes(name(e))||!m.content.includes('━━━━━━━━'))throw Error('Card readback failed '+e.slug);
 if(e.source_url&&!JSON.stringify(m.embeds[0].fields??[]).includes(e.source_url))throw Error('Original source lost '+e.slug);
 return {channelId:m.channel_id,messageId:m.id,url:'https://discord.com/channels/'+GUILD+'/'+m.channel_id+'/'+m.id};
}
let bot;
async function channelCheck(){
 bot=await api('/users/@me');if(!bot.bot||bot.id!=='1535522109571203152')throw Error('Canonical bot identity required');
 const c=await api('/channels/'+INDEX),f=await api('/channels/'+FORUM);
 if(c.name!=='🌳・medaka-lineage-trees'||c.parent_id!==CAT||f.type!==15||f.parent_id!==CAT)throw Error('Wrong Discord destination');
}
async function indexAudit(){
 const seen=new Map(),ids=new Set();let before='';
 for(let i=0;i<25;i++){
  const batch=await api('/channels/'+INDEX+'/messages?limit=100'+(before?'&before='+before:''));
  if(!batch.length)break;
  for(const m of batch){
   const slug=cardSlug(m);
   if(!slug)continue;
   if(seen.has(slug))throw Error('Existing duplicate index slug '+slug);
   seen.set(slug,m);
  }
  before=batch.at(-1).id;if(ids.has(before))throw Error('Index pagination stuck');ids.add(before);
  if(batch.length<100)break;
 }
 return seen;
}
async function verifyForumChannel(id){
 const c=await api('/channels/'+id);
 if(c.parent_id!==FORUM||![11,12].includes(c.type))throw Error('Not a Medaka research thread '+id);
}
async function findYoruThread(){
 const active=await api('/guilds/'+GUILD+'/threads/active');
 let all=[...(active.threads??[])].filter(t=>t.parent_id===FORUM);
 let before='';
 for(let i=0;i<25;i++){
  const a=await api('/channels/'+FORUM+'/threads/archived/public?limit=100'+(before?'&before='+encodeURIComponent(before):''));
  all.push(...(a.threads??[]));
  if(!a.has_more)break;
  before=a.threads?.at(-1)?.thread_metadata?.archive_timestamp;
  if(!before)throw Error('Archived pagination incomplete');
 }
 const found=[...new Map(all.map(t=>[t.id,t])).values()].filter(t=>/(^|\W)yoru($|\W)/i.test(t.name));
 if(found.length>1)throw Error('Ambiguous Yoru forum threads');
 if(found.length===1)return found[0].id;
 if(!apply)return null;
 const created=await api('/channels/'+FORUM+'/threads','POST',{
  name:'Picture lineage — yoru',auto_archive_duration:10080,
  message:{content:'🌳 Yoru — Medaka lineage research discussion\nParent lines are not documented; refer to Aquapedia for the current evidence record.',allowed_mentions:{parse:[]}}
 });
 if(!created.id)throw Error('Failed to create Yoru forum thread');
 return created.id;
}
async function exactThread(e){
 const link=e.existing_picture_discord_message_url;
 if(!link){if(e.slug!=='yoru')throw Error('Unexpected missing original forum URL '+e.slug);return findYoruThread();}
 const m=/^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/.exec(link);
 if(!m||m[1]!==GUILD)throw Error('Forum citation malformed '+e.slug);
 await verifyForumChannel(m[2]);
 const existing=await api('/channels/'+m[2]+'/messages/'+m[3]);
 if(!existing.author?.bot||!String(existing.content??'').toLowerCase().includes(e.slug)&&!String(existing.content??'').includes(e.site_url))throw Error('Unverified forum provenance '+e.slug);
 return m[2];
}
async function forumAudit(threadId,e){
 const messages=await api('/channels/'+threadId+'/messages?limit=100');
 const our=messages.filter(m=>m.author?.id===bot.id&&cardSlug(m)===e.slug);
 if(our.length>1)throw Error('Multiple prior new-card posts '+e.slug);
 if(our.length===1){
  if(our[0].embeds?.[0]?.footer?.text?.includes('AQUAPEDIA-MEDAKA-CARD-V1:'+e.slug))return {current:assertCard(our[0],e)};
  const old=our[0];
  if(!old.content?.includes('[AQUAPEDIA-MEDAKA-LINEAGE-V2:'+e.slug+']')||!old.content.includes(e.site_url)
    ||old.attachments?.length!==1||old.attachments[0].filename!==name(e))throw Error('Unsafe unreceipted forum post '+e.slug);
  return {orphanOldMessageId:old.id};
 }
 return null;
}
async function main(){
 await channelCheck();
 const initial=await indexAudit();
 // Resume is permitted only for an exact ID already recorded and read back in our own new-card ledger.
 const held=missing.filter(e=>initial.has(e.slug)&&initial.get(e.slug).id!==ledger.records[e.slug]?.index?.messageId);
 if(held.length)throw Error('Unreceipted index messages exist: '+held.map(x=>x.slug).join(','));
 if(fs.existsSync(path.join(R,'medaka-lineage-visual-v3.lock')))throw Error('In-place editor still active; do not overlap writers');
 console.log('PREFLIGHT '+JSON.stringify({held:missing.length,alreadyInIndex:held.length,apply,limit,bot:bot.id}));
 if(!apply){for(const e of missing.slice(0,Math.min(limit,4))){console.log('DRY '+e.slug+' '+png(e).length);}return;}
 let lock;try{lock=fs.openSync(LOCK,'wx');fs.writeSync(lock,String(process.pid));}catch{throw Error('Publisher locked');}
 try{
  for(const e of missing.slice(0,limit)){
   try{
    const picture=png(e);
    let threadId=ledger.records[e.slug]?.forum?.channelId??await exactThread(e);
    if(!threadId)throw Error('No verified forum thread '+e.slug);
    await verifyForumChannel(threadId);
    const existing=await forumAudit(threadId,e);
    let forum=existing?.current??null;
    if(!forum){
     // Reuse an unreceipted V2 orphan in place; NEVER duplicate that forum message.
     const orphan=existing?.orphanOldMessageId;
     const created=orphan
      ? await api('/channels/'+threadId+'/messages/'+orphan,'PATCH',form(e,threadId,picture))
      : await api('/channels/'+threadId+'/messages','POST',form(e,threadId,picture));
     forum=assertCard(await api('/channels/'+threadId+'/messages/'+created.id),e);
    }
    ledger.records[e.slug]={...ledger.records[e.slug],forum};save();
    let index=ledger.records[e.slug]?.index;
    if(index){
     index=assertCard(await api('/channels/'+INDEX+'/messages/'+index.messageId),e);
    }else{
     // Re-list index immediately before POST. Refuse racing orphans.
     const found=await indexAudit();
     if(found.has(e.slug))throw Error('An unreceipted index post appeared '+e.slug);
     const created=await api('/channels/'+INDEX+'/messages','POST',form(e,threadId,picture));
     index=assertCard(await api('/channels/'+INDEX+'/messages/'+created.id),e);
    }
    ledger.records[e.slug]={forum,index,verifiedAt:new Date().toISOString()};save();
    console.log('NEW_VERIFIED '+e.slug+' '+index.messageId);
    await sleep(700);
   }catch(err){ledger.errors.push({slug:e.slug,error:String(err.message),at:new Date().toISOString()});save();throw err;}
  }
  console.log('NEW_COMPLETE '+JSON.stringify({published:Object.values(ledger.records).filter(x=>x.index&&x.forum).length,needed:missing.length}));
 }finally{fs.closeSync(lock);fs.unlinkSync(LOCK);}
}
await main();
