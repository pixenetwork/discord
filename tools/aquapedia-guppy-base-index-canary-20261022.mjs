/**
 * Manual one-time Guppypedia source-only canary on the existing Aquaphoria
 * bot identity. This script is NOT a daemon or scheduler.
 * Requires exact --canary and exclusive existing autosync writer lock.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {buildGuppyBaseIndexCanary} from '../src/aquapedia-guppy-base-index-canary.mjs';
import {assessGuppySourceOnlyCanary} from '../src/aquapedia-guppy-source-only-guard.mjs';

const refuse=reason=>{throw Error('Guppy base index canary: '+reason)};
if(process.argv.slice(2).join(' ')!=='--canary')refuse('manual --canary argument required; no batch apply mode');
const root=process.cwd();
const lockFile=path.join(root,'data/aquapedia-autosync-writer.lock');
const receiptFile=path.join(root,'data/aquapedia-guppy-base-index-canary-receipt.v1.json');
const sourceTag='https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf';
const sha256=v=>createHash('sha256').update(v,'utf8').digest('hex');
let lock;

async function main(){
 const h=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 if(!h.ok||!h.initialized||h.startupFailed)refuse('existing bot is unhealthy');
 if(!process.env.DISCORD_TOKEN||!process.env.AQUAPHORIA_GUILD_ID)refuse('missing managed bot authentication');
 try{
  lock=fs.openSync(lockFile,'wx');
  fs.writeSync(lock,JSON.stringify({pid:process.pid,started:new Date().toISOString(),command:'source-only-guppy-canary'}));
 }catch(e){refuse('another existing publisher holds the shared writer lock: '+e.code);}
 try{
  const result=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
  if(!result.ok)refuse('catalog unavailable HTTP '+result.status);
  const catalog=await result.json();
  if(!Array.isArray(catalog)||catalog.length<853)refuse('unexpected source catalog shrinkage');
  const guppies=catalog.filter(x=>x.group==='guppy');
  const plan=buildGuppyBaseIndexCanary(guppies);
  const status=await fetch(sourceTag,{method:'HEAD',signal:AbortSignal.timeout(10000)});
  if(!status.ok)refuse('IKGH standard source not HEAD-accessible HTTP '+status.status);
  for(let i=1;i<=10;i++){
   const url='https://aquapedia.app/guppypedia/entries/gup-'+String(i).padStart(3,'0')+'/';
   const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(!r.ok)refuse('missing linked public Guppy entry '+url+' HTTP '+r.status);
   if(!(await r.text()).includes(sourceTag))refuse('Guppy entry missing primary IKGH source '+url);
  }
  const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
  const bot=await rest.get(Routes.user('@me'));
  const guildId=process.env.AQUAPHORIA_GUILD_ID;
  const thread=await rest.get(Routes.channel(plan.threadId));
  const parent=await rest.get(Routes.channel(thread.parent_id));
  const messages=await rest.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
  const decision=assessGuppySourceOnlyCanary({plan,botId:bot.id,guildId,thread,parent,messages});
  let prior=null;
  if(fs.existsSync(receiptFile)){
   prior=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
   if(prior.messageSha256!==sha256(plan.content)||prior.threadId!==plan.threadId||
      !/^\d{17,20}$/.test(prior.messageId||''))
     refuse('saved canary receipt differs from source identity');
  }
  if(prior&&decision.mode!=='adopt')refuse('receipt exists but matching current bot post not found');
  if(prior&&prior.messageId!==decision.existingMessageId)refuse('receipt/message collision');
  let messageId=decision.existingMessageId;
  let action=decision.mode==='adopt'?'adopted':'posted';
  if(decision.mode==='create'){
   const sent=await rest.post(Routes.channelMessages(plan.threadId),{
    body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
   });
   messageId=sent.id;
  }
  const post=await rest.get(Routes.channelMessage(plan.threadId,messageId));
  if(!post||post.id!==messageId||post.author?.id!==bot.id||post.content!==plan.content||
     (post.attachments||[]).length!==0)
   refuse('Discord message readback mismatch; do not claim publication');
  if(!prior){
   const receipt={
    version:1,scope:'source-only-standard-index; no pedigree verification',
    url:'https://discord.com/channels/'+guildId+'/'+plan.threadId+'/'+messageId,
    threadId:plan.threadId,messageId,
    botAuthorId:bot.id,messageSha256:sha256(plan.content),
    sourceEntryCount:10,sourceStatus:'IKGH show-standard terminology; breeding ancestry unverified',
    verified:true,verifiedAt:new Date().toISOString()
   };
   const tmp=receiptFile+'.tmp-'+process.pid;
   fs.writeFileSync(tmp,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
   fs.renameSync(tmp,receiptFile);
  }
  console.log('GUPPY_BASE_INDEX_CANARY_VERIFIED '+JSON.stringify({
   action,threadId:plan.threadId,messageId,sourceLinks:10,
   url:'https://discord.com/channels/'+guildId+'/'+plan.threadId+'/'+messageId,
   receiptFile,lockedWriterPreserved:true,sourceOnly:true,noPedigreeClaim:true
  }));
 }finally{
  if(lock!==undefined)fs.closeSync(lock);
  fs.unlinkSync(lockFile);
 }
}
await main();
