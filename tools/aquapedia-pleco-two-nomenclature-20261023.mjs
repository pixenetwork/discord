/**
 * One manually selected Plecopedia SOURCE-ONLY link per execution.
 * Existing Aquaphoria bot, existing public thread, shared writer lock,
 * live page/DOI verification, idempotent exact Discord GET receipt.
 * No automatic release, media attachments, new threads or assertions.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {buildPlecoNomenclatureIndex,PLECO_NOMENCLATURE_TARGETS} from '../src/aquapedia-pleco-two-nomenclature.mjs';
import {assessPlecoNomenclatureIndex} from '../src/aquapedia-pleco-two-nomenclature-guard.mjs';
const reject=why=>{throw Error('Pleco nomenclature source-only release: '+why)};
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--source-link'||!Object.hasOwn(PLECO_NOMENCLATURE_TARGETS,args[1]))
 reject('exactly one known --source-link key is required, no --apply or batch mode');
const key=args[1];
const root=process.cwd(),lockFile=path.join(root,'data/aquapedia-autosync-writer.lock');
const receiptFile=path.join(root,'data/aquapedia-pleco-two-nomenclature-'+key+'-receipt.v1.json');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(6000)}).then(x=>x.json());
 if(!health.ok||!health.initialized||health.startupFailed)reject('existing bot unavailable or not initialized');
 if(!process.env.DISCORD_TOKEN||process.env.AQUAPHORIA_GUILD_ID!=='1519337502379475095')
  reject('managed bot or original guild unavailable');
 try{
  lock=fs.openSync(lockFile,'wx');
  fs.writeSync(lock,JSON.stringify({pid:process.pid,key,started:new Date().toISOString(),scope:'single Pleco source-only link'}));
 }catch(e){reject('existing publisher lock held: '+e.code);}
 const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(20000)});
 if(!response.ok)reject('live source catalog HTTP '+response.status);
 const catalog=await response.json();
 if(!Array.isArray(catalog)||catalog.length<853)reject('unexpected site catalog shrinkage');
 const plan=buildPlecoNomenclatureIndex(catalog.filter(x=>x.group==='pleco'),key);
 const page=await fetch(plan.pageUrl,{signal:AbortSignal.timeout(15000)});
 if(!page.ok)reject('working public Pleco draft unavailable');
 const html=await page.text();
 if(!html.includes('Research draft'))
  reject('live source status changed; review before publication');
 if(key==='hyp-vandragti'){
  if(!html.toLowerCase().includes('10.1643/ci-10-008'))
   reject('original 2011 description citation absent from live draft');
  const source=await fetch('https://api.crossref.org/works/10.1643%2FCI-10-008',{
   signal:AbortSignal.timeout(14000),headers:{'User-Agent':'AquapediaReferenceIndex/1.0'}});
  if(!source.ok)reject('original DOI registry unavailable');
  const doi=String((await source.json()).message?.DOI||'').toLowerCase();
  if(doi!=='10.1643/ci-10-008')reject('original taxonomic DOI mismatch');
 }else if(key==='pana-changae'){
  if(!html.includes('Panaque_changae.pdf'))
   reject('2002 original description reference absent from live draft');
 }else reject('unrecognized taxonomic scope');
 const api=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const bot=await api.get(Routes.user('@me'));
 const thread=await api.get(Routes.channel(plan.threadId));
 const parent=await api.get(Routes.channel(thread.parent_id));
 const messages=await api.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const decision=assessPlecoNomenclatureIndex({
  plan,botId:bot.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent,messages
 });
 let prior=null;
 if(fs.existsSync(receiptFile)){
  prior=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(prior.key!==key||prior.threadId!==plan.threadId||
      prior.contentSha256!==sha(plan.content)||prior.verified!==true)
   reject('existing local receipt conflicts with live source');
 }
 if(prior&&(decision.mode!=='adopt'||prior.messageId!==decision.messageId))
  reject('local receipt and bot post mismatch');
 let messageId=decision.messageId;
 if(decision.mode==='create'){
  const out=await api.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=out.id;
 }
 const confirmed=await api.get(Routes.channelMessage(plan.threadId,messageId));
 if(!confirmed||confirmed.author?.id!==bot.id||confirmed.content!==plan.content||
  confirmed.id!==messageId||(confirmed.attachments||[]).length!==0)
  reject('Discord exact message readback failed; do not count as published');
 const url='https://discord.com/channels/'+process.env.AQUAPHORIA_GUILD_ID+'/'+plan.threadId+'/'+messageId;
 if(!prior){
  const record={version:1,verified:true,key,threadId:plan.threadId,messageId,
   url,botAuthorId:bot.id,sourceUrl:plan.pageUrl,originalReference:plan.originalSource,
   contentSha256:sha(plan.content),
   scope:'Provisional source-link index only; genetics, specimen ID, breeding outcomes and image rights not authenticated',
   verifiedAt:new Date().toISOString()};
  const tmp=receiptFile+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  fs.renameSync(tmp,receiptFile);
 }
 console.log('PLECO_NOMENCLATURE_INDEX_VERIFIED '+JSON.stringify({
  key,action:decision.mode==='adopt'?'adopted':'posted',threadId:plan.threadId,
  messageId,url,sourceUrl:plan.pageUrl,originalReference:plan.originalSource,
  claimVerified:false,mediaAttachments:0
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockFile);}
}
