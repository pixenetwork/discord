// Read-only exact-ID Discord audit for all 170 Medaka lineage cards.
import fs from 'node:fs';
import path from 'node:path';
import {cardSlug} from '../src/medaka-lineage-card.mjs';
const ROOT='D:\\PixelNetwork\\discord-lineage-sync-20261024', A='D:\\PixelNetwork\\aquapedia-lineage-export-20261024';
const INDEX='1563764327037669416',GUILD='1519337502379475095',BOT='1535522109571203152';
const manifest=JSON.parse(fs.readFileSync(path.join(A,'resources','medaka-discord-lineage-manifest.json'),'utf8'));
const first=JSON.parse(fs.readFileSync(path.join(ROOT,'reports','medaka-lineage-visual-v3-receipts.json'),'utf8'));
const created=JSON.parse(fs.readFileSync(path.join(ROOT,'reports','medaka-lineage-new-card-receipts.json'),'utf8'));
const prior=JSON.parse(fs.readFileSync(path.join(ROOT,'reports','medaka-lineage-sync-receipts.json'),'utf8'));
if(first.manifestBase!==manifest.aquapedia_commit||created.sourceHead!==first.rendererHead)throw Error('Revision mismatch');
if(fs.existsSync(path.join(ROOT,'reports','medaka-lineage-visual-v3.lock'))||fs.existsSync(path.join(ROOT,'reports','medaka-lineage-new-card.lock')))throw Error('Publisher lock still active');
const token=process.env.DISCORD_TOKEN;
if(!token||process.env.AQUAPHORIA_GUILD_ID!==GUILD)throw Error('Canonical bot runtime unavailable');
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function get(route){
 for(let a=0;a<8;a++){
  const r=await fetch('https://discord.com/api/v10'+route,{headers:{Authorization:'Bot '+token},signal:AbortSignal.timeout(30000)});
  const x=await r.json().catch(()=>({}));
  if(r.status===429){await sleep(Math.max(500,Math.min(60000,Number(x.retry_after??2)*1000+300)));continue;}
  if(r.status>=500&&a<7){await sleep(500*(a+1));continue;}
  if(!r.ok)throw Error('GET '+route+' '+r.status+' '+x.message);
  return x;
 }
 throw Error('Retry exhausted');
}
const bot=await get('/users/@me');if(bot.id!==BOT||!bot.bot)throw Error('Incorrect bot identity');
const intended=new Map(), ids=new Set();
for(const e of manifest.trees){
 const original=prior.records[e.slug],r=original?first.records[e.slug]:created.records[e.slug];
 if(!r)throw Error('Missing receipt '+e.slug);
 let index,forum;
 if(original){
  if(!r.completed||Object.keys(r.targets??{}).length!==2)throw Error('Incomplete legacy edit '+e.slug);
  index={channelId:INDEX,messageId:original.index.messageId};
  forum={channelId:original.original.threadId,messageId:original.original.messageId};
 }else{
  index=r.index;forum=r.forum;
 }
 for(const t of [index,forum]){
  if(!t?.channelId||!t?.messageId||ids.has(t.messageId))throw Error('Missing or reused ID '+e.slug);
  ids.add(t.messageId);
 }
 intended.set(e.slug,{e,index,forum});
}
if(intended.size!==170||Object.keys(first.records).length!==144||Object.keys(created.records).length!==26)throw Error('Receipt totals mismatch');
const found=new Map(); let before='';
for(let page=0;page<25;page++){
 const rows=await get('/channels/'+INDEX+'/messages?limit=100'+(before?'&before='+before:''));
 if(!rows.length)break;
 for(const m of rows){
  const slug=cardSlug(m);
  if(!slug)continue;
  if(found.has(slug))throw Error('Duplicate index post '+slug);
  found.set(slug,m);
 }
 before=rows.at(-1).id;
 if(rows.length<100)break;
}
const errors=[];
function check(m,info,kind){
 const {e,index,forum}=info;
 const expected=kind==='index'?index:forum;
 const image=m.embeds?.[0]?.image?.url??'';
 if(m.id!==expected.messageId||m.channel_id!==expected.channelId||m.author?.id!==BOT||cardSlug(m)!==e.slug||!m.content?.includes('━━━━━━━━')
 ||!image.includes('aquapedia-medaka-'+e.slug+'-picture-gene-tree.png'))throw Error(kind+' card broken '+e.slug);
 const fields=JSON.stringify(m.embeds?.[0]?.fields??[]);
 if(e.source_url&&!fields.includes(e.source_url))throw Error(kind+' source absent '+e.slug);
 if(!e.source_url&&!m.embeds?.[0]?.description?.includes('Parent lines not documented'))throw Error(kind+' unknown lineage misrepresented '+e.slug);
}
for(const [slug,info] of intended){
 try{const m=found.get(slug);if(!m)throw Error('Index missing '+slug);check(m,info,'index');}
 catch(e){errors.push(e.message);}
}
for(const slug of found.keys()){if(!intended.has(slug))errors.push('Extra lineage message '+slug);}
let cursor=0,forumsOkay=0;
const all=[...intended.values()];
async function worker(){
 while(cursor<all.length){
  const info=all[cursor++];
  try{const m=await get('/channels/'+info.forum.channelId+'/messages/'+info.forum.messageId);check(m,info,'forum');forumsOkay++;}
  catch(e){errors.push(e.message); }
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
console.log('LIVE_LINEAGE_AUDIT '+JSON.stringify({manifest:manifest.trees.length,legacyEdits:Object.keys(first.records).length,completedMissing:Object.keys(created.records).length,indexMessages:found.size,forumVerified:forumsOkay,verifiedById:ids.size,errors:errors.slice(0,12),errorCount:errors.length}));
if(errors.length||found.size!==170||forumsOkay!==170)process.exitCode=2;
