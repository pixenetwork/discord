/**
 * Manual, one-target named species source-only backlink.
 * Exact current source/CAS references, original managed bot/thread,
 * shared writer lock, exact Discord GET and durable idempotent receipt.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {buildPlecoNamedSourceIndex,PLECO_NAMED_SOURCE_TARGETS} from '../src/aquapedia-pleco-two-named-source.mjs';
import {assessPlecoNamedSourceIndex} from '../src/aquapedia-pleco-two-named-source-guard.mjs';
const fail=s=>{throw Error('Named-species Pleco directory release: '+s)};
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--source-link'||!Object.hasOwn(PLECO_NAMED_SOURCE_TARGETS,args[1]))
 fail('must name one approved existing species source-link, no batch/apply supported');
const key=args[1];
const lockPath=path.join(process.cwd(),'data/aquapedia-autosync-writer.lock');
const receiptPath=path.join(process.cwd(),'data/aquapedia-pleco-named-'+key+'-receipt.v1.json');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(6000)}).then(x=>x.json());
 if(!health.ok||!health.initialized||health.startupFailed)fail('existing bot unhealthy');
 if(!process.env.DISCORD_TOKEN||process.env.AQUAPHORIA_GUILD_ID!=='1519337502379475095')
  fail('original managed Discord bot credentials/guild missing');
 try{
  lock=fs.openSync(lockPath,'wx');
  fs.writeSync(lock,JSON.stringify({pid:process.pid,key,started:new Date().toISOString(),type:'manual named-species source-only index'}));
 }catch(e){fail('existing autosync writer lock already held: '+e.code);}
 const liveCatalog=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
 if(!liveCatalog.ok)fail('catalog unavailable');
 const full=await liveCatalog.json();
 if(!Array.isArray(full)||full.length<853)fail('catalog unexpectedly shrunk');
 const plan=buildPlecoNamedSourceIndex(full.filter(x=>x.group==='pleco'),key);
 const page=await fetch(plan.pageUrl,{signal:AbortSignal.timeout(14000)});
 if(!page.ok)fail('original Pleco source page unavailable');
 const html=await page.text();
 if(!html.includes('Research draft')||!html.includes(plan.catalogUrl))
  fail('working page missing original Catalog of Fishes citation or draft warning');
 const source=await fetch(plan.catalogUrl,{signal:AbortSignal.timeout(18000)});
 if(!source.ok)fail('Catalog of Fishes original species record unavailable');
 const catalogHtml=(await source.text()).toLowerCase();
 if(!catalogHtml.includes(plan.scientificName.toLowerCase().split(' ')[1])||
    !catalogHtml.includes(plan.authority.split(',')[0].toLowerCase().split(' ')[0])||
    !catalogHtml.includes('current status'))
  fail('original CAS taxon name/authorship evidence drift');
 const api=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const me=await api.get(Routes.user('@me'));
 const thread=await api.get(Routes.channel(plan.threadId));
 const forum=await api.get(Routes.channel(thread.parent_id));
 const messages=await api.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const status=assessPlecoNamedSourceIndex({
  plan,botId:me.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent:forum,messages
 });
 let prior=null;
 if(fs.existsSync(receiptPath)){
  prior=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if(prior.key!==key||prior.threadId!==plan.threadId||prior.messageSha256!==hash(plan.content)||prior.verified!==true)
   fail('prior local receipt does not match reviewed source plan');
 }
 if(prior&&(status.mode!=='adopt'||prior.messageId!==status.messageId))
  fail('Discord message conflicts with original on-host receipt');
 let messageId=status.messageId;
 if(status.mode==='create'){
  const posted=await api.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=posted.id;
 }
 const message=await api.get(Routes.channelMessage(plan.threadId,messageId));
 if(!message||message.id!==messageId||message.author?.id!==me.id||message.content!==plan.content||
    (message.attachments||[]).length!==0)
  fail('authored-message exact Discord API readback failed');
 const url='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+messageId;
 if(!prior){
  const receipt={version:1,verified:true,key,threadId:plan.threadId,messageId,botAuthorId:me.id,
   url,sourceUrl:plan.pageUrl,catalogUrl:plan.catalogUrl,messageSha256:hash(plan.content),
   scope:'Named-species bibliography source only, not specimen identity or breeder genealogy',
   verifiedAt:new Date().toISOString()};
  const temporary=receiptPath+'.tmp-'+process.pid;
  fs.writeFileSync(temporary,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  fs.renameSync(temporary,receiptPath);
 }
 console.log('PLECO_NAMED_SOURCE_VERIFIED '+JSON.stringify({
  key,action:status.mode==='adopt'?'adopted':'posted',messageId,url,threadId:plan.threadId,
  sourceUrl:plan.pageUrl,cas:plan.catalogUrl,attachments:0,specimenClaimVerified:false
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockPath);}
}
