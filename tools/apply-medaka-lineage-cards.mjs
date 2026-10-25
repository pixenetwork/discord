// Exclusive one-shot, EDIT-ONLY Medaka lineage Discord card replacement.
// No POST endpoints, no channel/thread creation and no long-running worker.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
import {extractLineageSvg, validateLineageManifest} from '../src/medaka-lineage-publisher.mjs';
import {planMedakaCardEdits} from '../src/medaka-lineage-card-plan.mjs';
import {cardSlug} from '../src/medaka-lineage-card.mjs';

const GUILD='1519337502379475095';
const INDEX='1563764327037669416';
const FORUM='1561189286399705128';
const CATEGORY='1561430495680667719';
const AQUA='D:\\PixelNetwork\\aquapedia-lineage-export-20261024';
const HERE='D:\\PixelNetwork\\discord-lineage-sync-20261024';
const REPORT=path.join(HERE,'reports');
const MANIFEST=path.join(AQUA,'resources','medaka-discord-lineage-manifest.json');
const PRIOR=path.join(REPORT,'medaka-lineage-sync-receipts.json');
const LEDGER=path.join(REPORT,'medaka-lineage-visual-v3-receipts.json');
const LOCK=path.join(REPORT,'medaka-lineage-visual-v3.lock');
const OLD_LOCK=path.join(REPORT,'medaka-lineage-writer.lock');
const AUTH=process.env.DISCORD_TOKEN;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const args=process.argv.slice(2);
const write=args.includes('--apply');
const slugArg=args.find(s=>s.startsWith('--slug='))?.slice(7)??null;
const limit=Number(args.find(s=>s.startsWith('--limit='))?.slice(8)??170);
const offset=Number(args.find(s=>s.startsWith('--offset='))?.slice(9)??0);
if(!Number.isInteger(limit)||limit<1||limit>170||!Number.isInteger(offset)||offset<0||offset>169)throw Error('Invalid range');
if(write&&!args.includes('--owner-approved-edit'))throw Error('Owner authorization flag required');
if(!AUTH||process.env.AQUAPHORIA_GUILD_ID!==GUILD)throw Error('Canonical Discord bot identity not available');
const manifest=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const prior=JSON.parse(fs.readFileSync(PRIOR,'utf8'));
validateLineageManifest(manifest);
const plan=planMedakaCardEdits(manifest,prior);
const trees=new Map(manifest.trees.map(x=>[x.slug,x]));
const ready=plan.entries.filter(e=>e.status==='ready_to_edit_existing_only');
let chosen=slugArg?ready.filter(e=>e.slug===slugArg):ready.slice(offset,offset+limit);
if(slugArg&&chosen.length!==1)throw Error('Requested slug has no verified edit receipt');
if(!chosen.length)throw Error('No verified messages for chosen entries');
const gitHead=(cwd)=>execFileSync('git',['-C',cwd,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const aquaHead=gitHead(AQUA);
if(!/^[0-9a-f]{40}$/.test(process.env.AQUAPEDIA_LINEAGE_RENDERER_HEAD??'')||aquaHead!==process.env.AQUAPEDIA_LINEAGE_RENDERER_HEAD)throw Error('Explicit approved Aquapedia renderer HEAD required; fail closed');
const done=fs.existsSync(LEDGER)?JSON.parse(fs.readFileSync(LEDGER,'utf8')):{
  schemaVersion:1, manifestBase:manifest.aquapedia_commit, rendererHead:aquaHead,
  guildId:GUILD, indexChannelId:INDEX, records:{}, failures:[]};
if(done.manifestBase!==manifest.aquapedia_commit||done.rendererHead!==aquaHead||done.guildId!==GUILD||done.indexChannelId!==INDEX)throw Error('Upgrade ledger revision mismatch');
const fileName=e=>'aquapedia-medaka-'+e.slug+'-picture-gene-tree.png';
const writeLedger=()=>{
 const temp=LEDGER+'.tmp-'+process.pid;
 fs.writeFileSync(temp,JSON.stringify(done,null,2)+'\n',{flag:'w'});
 fs.renameSync(temp,LEDGER);
};
function artwork(slug){
 const page=fs.readFileSync(path.join(AQUA,'site','medakapedia','strains',slug,'index.html'),'utf8');
 const svg=extractLineageSvg(page);
 if(!svg.includes('viewBox')||!svg.includes('Parent lines')&&!svg.includes('source')){ /* visual renderer only, provenance stays on card */ }
 const png=new Resvg(svg,{fitTo:{mode:'width',value:1500}}).render().asPng();
 if(png.length<1000||png.length>7_000_000||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG '+slug);
 return png;
}
let me;
async function api(route,method='GET',form){
 for(let retry=0;retry<7;retry++){
  const res=await fetch('https://discord.com/api/v10'+route,{
   method,headers:{Authorization:'Bot '+AUTH},body:form,signal:AbortSignal.timeout(30000)
  });
  const result=res.status===204?{}:await res.json().catch(()=>({}));
  if(res.status===429){
   const wait=Math.max(500,Math.min(60_000,Number(result.retry_after??2)*1000+300));
   await sleep(wait); continue;
  }
  if(res.status>=500&&retry<6){await sleep(800*(retry+1));continue;}
  if(!res.ok)throw Error('Discord '+method+' '+route+' HTTP '+res.status+' '+(result.code??'')+' '+String(result.message??'').slice(0,160));
  return result;
 }
 throw Error('Discord retries exhausted '+route);
}
async function preflight(){
 me=await api('/users/@me');
 if(me?.bot!==true||!me.id)throw Error('Expected bot identity');
 const index=await api('/channels/'+INDEX);
 const forum=await api('/channels/'+FORUM);
 if(index.type!==0||index.parent_id!==CATEGORY||index.name!=='🌳・medaka-lineage-trees')throw Error('Index channel identity changed');
 if(forum.type!==15||forum.parent_id!==CATEGORY)throw Error('Forum changed');
 console.log('PREFLIGHT '+JSON.stringify({editOnly:true,botId:me.id,ready:plan.ready,held:plan.held,selected:chosen.length,apply:write,base:manifest.aquapedia_commit,rendererHead:aquaHead}));
}
const targetRoute=t=>'/channels/'+t.channelId+'/messages/'+t.messageId;
const channels=new Map();
async function inspectTarget(entry,target){
 if(target.channelId!==INDEX){
  if(!channels.has(target.channelId))channels.set(target.channelId,await api('/channels/'+target.channelId));
  const c=channels.get(target.channelId);
  if(c.parent_id!==FORUM||![11,12].includes(c.type))throw Error('Target not in Medaka forum '+entry.slug);
 }
 const msg=await api(targetRoute(target));
 if(msg.channel_id!==target.channelId||msg.id!==target.messageId||msg.author?.id!==me.id)throw Error('Source message not owned by canonical bot '+entry.slug);
 if(cardSlug(msg)!==entry.slug)throw Error('Source message does not match verified strain '+entry.slug);
 const embedded=msg.embeds?.[0]?.footer?.text?.includes('AQUAPEDIA-MEDAKA-CARD-V1:'+entry.slug)&&msg.embeds?.[0]?.image?.url?.includes(entry.pngFileName);
 const oldFile=msg.attachments?.length===1&&msg.attachments[0].filename===entry.pngFileName;
 if(!embedded&&!oldFile)throw Error('Source attachment unexpected '+entry.slug);
 return msg;
}
function replacementForm(entry,png){
 const form=new FormData();
 form.append('payload_json',JSON.stringify({...entry.card,attachments:[{
  id:0,filename:entry.pngFileName,description:'Aquapedia horizontal Medaka lineage; cited breeder-reported sources and confidence below'
 }]}));
 form.append('files[0]',new Blob([png],{type:'image/png'}),entry.pngFileName);
 return form;
}
function verifyCard(message,entry){
 if(message.author?.id!==me.id||cardSlug(message)!==entry.slug||message.content!==entry.card.content)throw Error('Card readback identity/content mismatch '+entry.slug);
 const embed=message.embeds?.[0];
 if(!embed?.image?.url?.includes(entry.pngFileName)||!embed?.footer?.text?.includes('AQUAPEDIA-MEDAKA-CARD-V1:'+entry.slug))throw Error('Card image/marker missing '+entry.slug);
 // Discord promotes attachment:// PNGs to embed images, commonly returning attachments: [].
 if(message.attachments?.length>1)throw Error('Unexpected extra attachments '+entry.slug);
 if(message.attachments?.length===1&&(message.attachments[0].filename!==entry.pngFileName||message.attachments[0].size<1000))throw Error('Card attachment mismatch '+entry.slug);
 const source=trees.get(entry.slug).source_url;
 if(source&&!JSON.stringify(embed.fields??[]).includes(source))throw Error('Original breeder source lost '+entry.slug);
}
async function updateOne(entry,png,target){
 const msg=await inspectTarget(entry,target);
 if(msg.embeds?.[0]?.footer?.text?.includes('AQUAPEDIA-MEDAKA-CARD-V1:'+entry.slug)&&msg.content===entry.card.content){
  verifyCard(msg,entry);
  return {url:target.priorUrl,messageId:target.messageId,alreadyCurrent:true,verifiedAt:new Date().toISOString()};
 }
 if(!write)return {url:target.priorUrl,messageId:target.messageId,ready:true};
 await api(targetRoute(target),'PATCH',replacementForm(entry,png));
 const back=await api(targetRoute(target));
 verifyCard(back,entry);
 return {url:target.priorUrl,messageId:target.messageId,updated:true,verifiedAt:new Date().toISOString(),imageUrl:back.embeds[0].image.url};
}
async function checkExclusive(){
 // The stopped V2 publisher left a stale lock. Do not touch it unless a separate
 // Windows process listing establishes no active V2 publisher.
 if(fs.existsSync(OLD_LOCK)){
  const cmd='@(Get-CimInstance Win32_Process -Filter \'Name = "node.exe"\' | Where-Object { $_.CommandLine -like \'*run-medaka-lineage-sync.mjs*\' }).Count';
  const active=execFileSync('powershell',['-NoProfile','-Command',cmd],{encoding:'utf8'}).trim();
  if(active!=='0')throw Error('Old lineage publisher is active; refusing concurrent edits: '+active);
  const priorLock=JSON.parse(fs.readFileSync(OLD_LOCK,'utf8'));
  if(priorLock.pid){
   try{process.kill(priorLock.pid,0);throw Error('Old writer PID still alive; stop and audit it first');}catch(e){if(e.message.includes('Old writer PID'))throw e;}
  }
  fs.renameSync(OLD_LOCK,OLD_LOCK+'.archived-before-visual-upgrade');
 }
}
async function main(){
 await preflight();
 if(!write){
  for(const entry of chosen.slice(0,Math.min(chosen.length,3))){
   const png=artwork(entry.slug);
   const results=[];
   for(const target of entry.targets)results.push(await updateOne(entry,png,target));
   console.log('DRY_RUN '+JSON.stringify({slug:entry.slug,bytes:png.length,targets:results}));
  }
  console.log('DRY_RUN_COMPLETE no messages modified');
  return;
 }
 await checkExclusive();
 fs.mkdirSync(REPORT,{recursive:true});
 let fd;
 try{fd=fs.openSync(LOCK,'wx');fs.writeSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString(),source:aquaHead}));}
 catch{throw Error('Another lineage visual editor holds exclusive lock');}
 try{
  for(const [i,entry] of chosen.entries()){
   const png=artwork(entry.slug);
   const existing=done.records[entry.slug]??{targets:{}};
   try{
    for(const target of entry.targets){
     const result=await updateOne(entry,png,target);
     existing.targets[target.channelId]=result;
     done.records[entry.slug]={...existing,slug:entry.slug,revision:aquaHead,completed:Object.keys(existing.targets).length===2};
     writeLedger();
     await sleep(650);
    }
    console.log('EDIT_VERIFIED '+JSON.stringify({n:i+1,total:chosen.length,slug:entry.slug,count:Object.keys(done.records).length}));
   }catch(e){
    done.failures.push({slug:entry.slug,at:new Date().toISOString(),message:String(e.message)});
    writeLedger();
    console.error('STOPPED '+entry.slug+' '+e.message);
    throw e;
   }
  }
  console.log('EDIT_COMPLETE '+JSON.stringify({selected:chosen.length,verified:Object.values(done.records).filter(x=>x.completed).length,held:plan.held}));
 }finally{
  fs.closeSync(fd);fs.unlinkSync(LOCK);
 }
}
await main();
