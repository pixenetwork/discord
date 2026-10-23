/**
 * Three explicit one-time, source-only IKGH index entries on EXISTING
 * Aquaphoria bot threads. No scheduler, new threads, media or unreviewed
 * phenotype/genotype/pedigree assertions. One post maximum per invocation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {buildRemainingGuppyIndex,GUPPY_REMAINING_TOPIC_SPECS} from '../src/aquapedia-guppy-remaining-index.mjs';
import {assessRemainingGuppyPost} from '../src/aquapedia-guppy-remaining-guard.mjs';
const refuse=why=>{throw Error('Guppy source-only release: '+why)};
const argv=process.argv.slice(2);
if(argv.length!==2||argv[0]!=='--topic'||!Object.hasOwn(GUPPY_REMAINING_TOPIC_SPECS,argv[1]))
 refuse('only --topic cover-one | cover-two | tail permitted');
const topic=argv[1],root=process.cwd();
const lockFile=path.join(root,'data/aquapedia-autosync-writer.lock');
const receiptFile=path.join(root,'data/aquapedia-guppy-source-only-'+topic+'-receipt.v1.json');
const ikgh='https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf';
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 if(!health.ok||!health.initialized||health.startupFailed)refuse('existing bot unhealthy');
 if(!process.env.DISCORD_TOKEN||!process.env.AQUAPHORIA_GUILD_ID)refuse('missing managed bot environment');
 try{lock=fs.openSync(lockFile,'wx');fs.writeSync(lock,JSON.stringify({pid:process.pid,topic,createdAt:new Date().toISOString()}));}
 catch(e){refuse('existing single-writer lock held: '+e.code);}
 const res=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(16000)});
 if(!res.ok)refuse('public catalog unavailable '+res.status);
 const catalog=await res.json();
 if(!Array.isArray(catalog)||catalog.length<853)refuse('catalog count shrank');
 const plan=buildRemainingGuppyIndex(catalog.filter(x=>x.group==='guppy'),topic);
 const source=await fetch(ikgh,{method:'HEAD',signal:AbortSignal.timeout(14000)});
 if(!source.ok)refuse('primary source not HEAD-accessible '+source.status);
 let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(cursor<plan.entryUrls.length){
   const page=plan.entryUrls[cursor++];
   const r=await fetch(page,{signal:AbortSignal.timeout(14000)});
   if(!r.ok)refuse('missing public working research page '+page);
   if(!(await r.text()).includes(ikgh))refuse('working research lacks IKGH citation '+page);
  }
 }));
 const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const bot=await rest.get(Routes.user('@me'));
 const thread=await rest.get(Routes.channel(plan.threadId));
 const parent=await rest.get(Routes.channel(thread.parent_id));
 const messages=await rest.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const gate=assessRemainingGuppyPost({plan,botId:bot.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent,messages});
 let previous=null;
 if(fs.existsSync(receiptFile)){
  previous=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(previous.messageSha256!==hash(plan.content)||previous.threadId!==plan.threadId||
   previous.topic!==topic||previous.verified!==true)refuse('durable receipt conflict');
 }
 if(previous&&(gate.mode!=='adopt'||previous.messageId!==gate.existingId))refuse('receipt and live post differ');
 let messageId=gate.existingId;
 if(gate.mode==='create'){
  const sent=await rest.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=sent.id;
 }
 const result=await rest.get(Routes.channelMessage(plan.threadId,messageId));
 if(!result||result.author?.id!==bot.id||result.content!==plan.content||
  result.id!==messageId||(result.attachments||[]).length)
  refuse('readback failed; do not record publication success');
 if(!previous){
  const record={version:1,topic,verified:true,messageId,threadId:plan.threadId,
   url:'https://discord.com/channels/'+process.env.AQUAPHORIA_GUILD_ID+'/'+plan.threadId+'/'+messageId,
   botAuthorId:bot.id,messageSha256:hash(plan.content),sourceEntryCount:plan.entryUrls.length,
   sourceUrls:plan.entryUrls,claimScope:'IKGH show-standard classification, not verified genotype or pedigree',
   verifiedAt:new Date().toISOString()};
  const tmp=receiptFile+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  fs.renameSync(tmp,receiptFile);
 }
 console.log('GUPPY_IKGH_INDEX_VERIFIED '+JSON.stringify({
  topic,action:gate.mode==='adopt'?'adopted':'posted',
  threadId:plan.threadId,messageId,linkedEntries:plan.entryUrls.length,
  url:'https://discord.com/channels/'+process.env.AQUAPHORIA_GUILD_ID+'/'+plan.threadId+'/'+messageId,
  sourceOnly:true,unverifiedPedigreesHeld:true
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockFile);}
}
