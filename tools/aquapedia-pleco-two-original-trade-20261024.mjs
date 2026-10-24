/**
 * Original managed bot, ONE Plecopedia direct-description bibliography
 * backlink per command. Fails closed on source, Discord or receipt drift.
 * No images, second writers, scheduled workers or archived operations.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {PLECO_TWO_ORIGINAL_TRADE,buildPlecoOriginalTradeIndex} from '../src/aquapedia-pleco-two-original-trade.mjs';
import {assessPlecoOriginalTradeIndex} from '../src/aquapedia-pleco-two-original-trade-guard.mjs';
const fail=s=>{throw Error('Pleco original-trade release: '+s)};
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--source-link'||!Object.hasOwn(PLECO_TWO_ORIGINAL_TRADE,args[1]))
 fail('select exactly one named reviewed entry; no apply/batch accepted');
const key=args[1];
const lockPath=path.join(process.cwd(),'data/aquapedia-autosync-writer.lock');
const receiptPath=path.join(process.cwd(),'data/aquapedia-pleco-original-trade-'+key+'-receipt.v1.json');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(6000)}).then(r=>r.json());
 if(!health.ok||!health.initialized||health.startupFailed)fail('original bot unavailable');
 if(!process.env.DISCORD_TOKEN||process.env.AQUAPHORIA_GUILD_ID!=='1519337502379475095')
  fail('managed bot/guild mismatch');
 try{
  lock=fs.openSync(lockPath,'wx');
  fs.writeSync(lock,JSON.stringify({pid:process.pid,key,at:new Date().toISOString(),scope:'one original taxonomy source backlink'}));
 }catch(e){fail('one-writer lock held '+e.code);}
 const r=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
 if(!r.ok)fail('live source catalog unavailable');
 const all=await r.json();
 if(!Array.isArray(all)||all.length<853)fail('live source shrinkage');
 const plan=buildPlecoOriginalTradeIndex(all.filter(x=>x.group==='pleco'),key);
 const page=await fetch(plan.pageUrl,{signal:AbortSignal.timeout(18000)});
 if(!page.ok)fail('public research article unavailable');
 const html=(await page.text()).toLowerCase();
 if(!html.includes('research draft')||!html.includes(plan.doi.toLowerCase()))
  fail('research status or original DOI citation absent from live article');
 const cr=await fetch('https://api.crossref.org/works/'+encodeURIComponent(plan.doi),{
  signal:AbortSignal.timeout(16000),headers:{'User-Agent':'AquapediaOriginalSourceIndex/1.0'}
 });
 if(!cr.ok)fail('original registered DOI metadata unavailable');
 const paper=(await cr.json()).message;
 if(String(paper?.DOI||'').toLowerCase()!==plan.doi.toLowerCase())fail('original DOI identity mismatch');
 const title=String(paper?.title?.[0]||'').toLowerCase();
 if(key==='l239'&&!title.includes('baryancistrus'))fail('original Baryancistrus paper title changed');
 if(key==='l398'&&!(title.includes('panaqolus')&&title.includes('new species')))
  fail('original Panaqolus description title changed');
 const api=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const me=await api.get(Routes.user('@me'));
 const thread=await api.get(Routes.channel(plan.threadId));
 const parent=await api.get(Routes.channel(thread.parent_id));
 const history=await api.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const assessment=assessPlecoOriginalTradeIndex({
  plan,botId:me.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent,messages:history
 });
 let previous=null;
 if(fs.existsSync(receiptPath)){
  previous=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if(!previous.verified||previous.key!==key||previous.threadId!==plan.threadId||
     previous.contentSha256!==sha(plan.content)||previous.doi!==plan.doi)
   fail('on-host original message receipt does not match');
 }
 if(previous&&(assessment.mode!=='adopt'||assessment.messageId!==previous.messageId))
   fail('on-host receipt and live Discord message disagree');
 let messageId=assessment.messageId;
 if(assessment.mode==='create'){
  const posted=await api.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=posted.id;
 }
 const confirmed=await api.get(Routes.channelMessage(plan.threadId,messageId));
 if(confirmed.id!==messageId||confirmed.author?.id!==me.id||
    confirmed.content!==plan.content||(confirmed.attachments||[]).length)
  fail('authored Discord message exact readback failed');
 const url='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+messageId;
 if(!previous){
  const record={version:1,verified:true,key,threadId:plan.threadId,messageId,url,
   botAuthorId:me.id,sourceUrl:plan.pageUrl,doi:plan.doi,contentSha256:sha(plan.content),
   scope:'Original described species and historical trade code only; no fish specimen/genetic authentication',
   verifiedAt:new Date().toISOString()};
  const temp=receiptPath+'.tmp-'+process.pid;
  fs.writeFileSync(temp,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  fs.renameSync(temp,receiptPath);
 }
 console.log('PLECO_ORIGINAL_TRADE_INDEX_VERIFIED '+JSON.stringify({
  key,action:assessment.mode==='adopt'?'adopted':'posted',messageId,url,
  doi:plan.doi,sourceUrl:plan.pageUrl,media:0,breedingGeneticsVerified:false
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockPath);}
}
