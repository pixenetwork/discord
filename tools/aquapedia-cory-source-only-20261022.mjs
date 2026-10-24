/**
 * One-time public Corydoraspedia SOURCE LINK only. Never publishes keeper
 * claims or images. Existing managed bot, exclusive autosync writer lock,
 * duplicate marker/URL scan, Discord GET readback, atomic receipt.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {CORY_LINK_ONLY_TARGETS,buildCorySourceOnlyBacklink} from '../src/aquapedia-cory-source-only-backlink.mjs';
import {assessCorySourceOnlyTarget} from '../src/aquapedia-cory-source-only-guard.mjs';
const no=why=>{throw Error('Cory source-only release: '+why)};
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--source-link'||!Object.hasOwn(CORY_LINK_ONLY_TARGETS,args[1]))
 no('expected exactly one named existing Cory source-link target');
const key=args[1];
const root=process.cwd();
const lockFile=path.join(root,'data/aquapedia-autosync-writer.lock');
const receiptFile=path.join(root,'data/aquapedia-cory-source-only-'+key+'-receipt.v1.json');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 if(!health.ok||!health.initialized||health.startupFailed)no('existing bot unavailable');
 if(!process.env.DISCORD_TOKEN||!process.env.AQUAPHORIA_GUILD_ID)no('managed credentials not configured');
 try{lock=fs.openSync(lockFile,'wx');fs.writeSync(lock,JSON.stringify({pid:process.pid,key,started:new Date().toISOString()}));}
 catch(e){no('existing publisher holds shared lock '+e.code);}
 const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)no('live source catalog failed '+response.status);
 const all=await response.json();
 if(!Array.isArray(all)||all.length<853)no('unexpected source catalog shrinkage');
 const plan=buildCorySourceOnlyBacklink(all.filter(x=>x.group==='corydoras'),key);
 const page=await fetch('https://aquapedia.app/corydoraspedia/breeding/',{signal:AbortSignal.timeout(14000)});
 if(!page.ok)no('working breeding research page unavailable');
 const html=await page.text();
 if(!html.includes('id="'+plan.anchor+'"')&&!html.includes("id='"+plan.anchor+"'"))
  no('working report section anchor unavailable');
 const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const me=await rest.get(Routes.user('@me'));
 const thread=await rest.get(Routes.channel(plan.threadId));
 const parent=await rest.get(Routes.channel(thread.parent_id));
 const messages=await rest.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const gate=assessCorySourceOnlyTarget({plan,botId:me.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent,messages});
 let previous=null;
 if(fs.existsSync(receiptFile)){
  previous=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(previous.key!==key||previous.threadId!==plan.threadId||previous.messageSha256!==sha(plan.content)||previous.verified!==true)
   no('saved source receipt conflicts with current report');
 }
 if(previous&&(gate.mode!=='adopt'||previous.messageId!==gate.messageId))
  no('receipt/live message collision');
 let messageId=gate.messageId;
 if(gate.mode==='create'){
  const msg=await rest.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=msg.id;
 }
 const verified=await rest.get(Routes.channelMessage(plan.threadId,messageId));
 if(!verified||verified.id!==messageId||verified.author?.id!==me.id||verified.content!==plan.content||
    (verified.attachments||[]).length!==0)no('Discord exact readback failed');
 const url='https://discord.com/channels/'+process.env.AQUAPHORIA_GUILD_ID+'/'+plan.threadId+'/'+messageId;
 if(!previous){
  const receipt={version:1,key,verified:true,threadId:plan.threadId,messageId,url,botAuthorId:me.id,
   sourceUrl:plan.pageUrl,messageSha256:sha(plan.content),
   claimStatus:'Link to keeper observation only. Not universally verified breeding conditions or pedigree.',
   verifiedAt:new Date().toISOString()};
  const tmp=receiptFile+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  fs.renameSync(tmp,receiptFile);
 }
 console.log('CORY_SOURCE_ONLY_LINK_VERIFIED '+JSON.stringify({
  key,action:gate.mode==='adopt'?'adopted':'posted',threadId:plan.threadId,messageId,url,
  sourceUrl:plan.pageUrl,claimVerified:false,photos:0
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockFile);}
}
