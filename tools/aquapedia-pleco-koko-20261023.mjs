/**
 * Manual one-time corrected-genus research source index; original managed
 * bot and exclusive writer, exact CAS + Crossref site/source evidence,
 * prior-public-link rejection and durable original-message receipt.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes} from 'discord.js';
import {KOKO_SOURCE_PLAN,buildPlecoKokoIndex} from '../src/aquapedia-pleco-koko-source.mjs';
import {assessPlecoKokoIndex} from '../src/aquapedia-pleco-koko-guard.mjs';
const fail=s=>{throw Error('Pleco koko bibliography release: '+s)};
if(process.argv.length!==4||process.argv[2]!=='--source-link'||process.argv[3]!=='pana-koko')
 fail('exactly one reviewed source link is allowed');
const lockPath=path.join(process.cwd(),'data/aquapedia-autosync-writer.lock');
const receiptPath=path.join(process.cwd(),'data/aquapedia-pleco-koko-nomenclature-receipt.v1.json');
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
let lock;
try{
 const health=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(6000)}).then(x=>x.json());
 if(!health.ok||!health.initialized||health.startupFailed)fail('managed original bot unhealthy');
 if(!process.env.DISCORD_TOKEN||process.env.AQUAPHORIA_GUILD_ID!=='1519337502379475095')
  fail('managed bot/guild unavailable');
 try{
  lock=fs.openSync(lockPath,'wx');
  fs.writeSync(lock,JSON.stringify({pid:process.pid,source:'koko',started:new Date().toISOString()}));
 }catch(e){fail('existing exclusive writer lock occupied: '+e.code);}
 const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
 if(!response.ok)fail('site catalog unavailable');
 const records=await response.json();
 if(!Array.isArray(records)||records.length<853)fail('unexpected source catalog shrinkage');
 const plan=buildPlecoKokoIndex(records.filter(x=>x.group==='pleco'));
 const page=await fetch(plan.pageUrl,{signal:AbortSignal.timeout(18000)});
 if(!page.ok)fail('public entry unavailable');
 const html=(await page.text()).toLowerCase();
 if(!html.includes('research draft')||!html.includes(plan.spid)||
    !html.includes('fischmuller')||!html.includes('sfi-cybium'))
  fail('live public page bibliography or provisional status drifted');
 const cas=await fetch(plan.catalogUrl,{signal:AbortSignal.timeout(18000)});
 if(!cas.ok)fail('Eschmeyer taxonomic catalog unavailable');
 const casText=(await cas.text()).toLowerCase();
 if(!casText.includes('pseudoqolus')||!casText.includes('panaqolus koko')||
    !casText.includes('fisch-muller')||!casText.includes('current status'))
  fail('authoritative original and current taxon nomenclature unavailable');
 const cr=await fetch('https://api.crossref.org/works/'+encodeURIComponent(plan.phylogenyDoi),{
  signal:AbortSignal.timeout(18000),headers:{'User-Agent':'AquapediaResearchIndex/1.0'}});
 if(!cr.ok)fail('2017 molecular phylogeny primary DOI registry unavailable');
 const study=(await cr.json()).message;
 if(String(study?.DOI||'').toLowerCase()!==plan.phylogenyDoi||
    !String(study?.title?.[0]||'').toLowerCase().includes('multilocus molecular phylogeny'))
  fail('2017 genus paper bibliographic identity mismatch');
 const api=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 const bot=await api.get(Routes.user('@me'));
 const thread=await api.get(Routes.channel(plan.threadId));
 const parent=await api.get(Routes.channel(thread.parent_id));
 const messages=await api.get(Routes.channelMessages(plan.threadId),{query:new URLSearchParams({limit:'100'})});
 const state=assessPlecoKokoIndex({
  plan,botId:bot.id,guildId:process.env.AQUAPHORIA_GUILD_ID,thread,parent,messages
 });
 let prior=null;
 if(fs.existsSync(receiptPath)){
  prior=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
  if(!prior.verified||prior.sourceUrl!==plan.pageUrl||prior.threadId!==plan.threadId||
     prior.contentSha256!==hash(plan.content))
   fail('on-host original receipt drift');
 }
 if(prior&&(state.mode!=='adopt'||prior.messageId!==state.messageId))
  fail('original receipt conflicts with live Discord content');
 let messageId=state.messageId;
 if(state.mode==='create'){
  const posted=await api.post(Routes.channelMessages(plan.threadId),{
   body:{content:plan.content,allowed_mentions:{parse:[]},flags:4}
  });
  messageId=posted.id;
 }
 const check=await api.get(Routes.channelMessage(plan.threadId,messageId));
 if(check.id!==messageId||check.author?.id!==bot.id||check.content!==plan.content||
    (check.attachments||[]).length!==0)fail('exact authenticated message readback mismatch');
 const url='https://discord.com/channels/1519337502379475095/'+plan.threadId+'/'+messageId;
 if(!prior){
  const record={
   version:1,verified:true,key:plan.key,threadId:plan.threadId,messageId,url,
   sourceUrl:plan.pageUrl,originalName:plan.originalName,acceptedName:plan.acceptedName,
   botAuthorId:bot.id,contentSha256:hash(plan.content),
   studyDoi:plan.phylogenyDoi,scope:'Taxonomic nomenclature source only; introgression remains hypothetical',
   verifiedAt:new Date().toISOString()
  };
  const tmp=receiptPath+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  fs.renameSync(tmp,receiptPath);
 }
 console.log('KOKO_NOMENCLATURE_INDEX_VERIFIED '+JSON.stringify({
  action:state.mode==='adopt'?'adopted':'posted',key:plan.key,messageId,url,
  sourceUrl:plan.pageUrl,photos:0,breedingLineageVerified:false
 }));
}finally{
 if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockPath);}
}
