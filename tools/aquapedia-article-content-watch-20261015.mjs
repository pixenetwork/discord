/**
 * Independent full-article change monitor for Aquapedia + Aquaphoria.
 * Reuses EXISTING hourly All Websites Content & Commerce wakeup, no new scheduler.
 * --seed: fetch and hash all prior verified public research pages. No Discord changes.
 * --check: inspect all pages read-only and show actual content changes.
 * --apply: publish at most 50 genuine text/content revisions; verify live Discord receipt.
 * Separate checkpoint; honors the other autosync's SAME exclusive writer lock.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {REST,Routes,ChannelType,PermissionFlagsBits} from 'discord.js';
import {renderAquapediaCard} from './aquapedia-post-card.mjs';
import {requiredChannelKinds,articleWriteAction,ARTICLE_UPDATE_HEADING,normalizeAquapediaArticleName,acquireArticleWriterLock,guardArticleBulkChange} from './aquapedia-article-destination-policy.mjs';

const mode=process.argv.includes('--seed')?'seed':process.argv.includes('--apply')?'apply':'check';
const base='https://aquapedia.app';
const file=path.resolve('data/aquapedia-article-content-checkpoint.v1.json');
const lockFile=path.resolve('data/aquapedia-autosync-writer.lock');
const priorFile=path.resolve('data/aquapedia-autosync-state.v1.json');
const hash=x=>createHash('sha256').update(x).digest('hex');
const cap=50;
function saveAtomically(v){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.tmp-'+process.pid;
 fs.writeFileSync(tmp,JSON.stringify(v,null,2),{encoding:'utf8',flag:'wx'});
 fs.renameSync(tmp,file);
}
function pagePath(v){
 return typeof v==='string'&&/^\/(?:medakapedia|shrimpapedia|arowanapedia)\//.test(v)
  && !/\.\.|[?#<>"']/g.test(v)&&v.endsWith('/')?v:null;
}
function meaningful(main){
 return main.replace(/<!--[^]*?-->/g,'')
  .replace(/<script\b[^>]*>[^]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[^]*?<\/style>/gi,'')
  .replace(/\s+/g,' ').trim();
}
async function getPage(url){
 const resp=await fetch(base+url+'?article_audit='+Date.now(),{
  headers:{'user-agent':'Aquapedia/1.0 verified-content-diff (private Discord)'},
  signal:AbortSignal.timeout(14000)
 });
 if(!resp.ok)throw Error('HTTP '+resp.status);
 const html=await resp.text();
 const found=html.match(/<main\s+id="main"[^>]*>([\s\S]*?)<\/main>/i);
 if(!found||found[1].length<180)throw Error('No meaningful article main section');
 const main=meaningful(found[1]);
 const title=html.match(/<title>([^<]{1,250})<\/title>/i)?.[1]?.trim()||url;
 return {digest:hash(main),title,bytes:main.length};
}
async function pool(input,limit,work){
 let next=0;
 const output=new Array(input.length);
 const workers=Array.from({length:Math.min(limit,input.length)},async()=>{
  while(next<input.length){
   const i=next++;
   try{output[i]={url:input[i],value:await work(input[i])}}
   catch(e){output[i]={url:input[i],error:String(e.message||e)}}
  }
 });
 await Promise.all(workers);
 return output;
}
const old=JSON.parse(fs.readFileSync(priorFile,'utf8'));
if(old.version!==1||Object.keys(old.catalogHashes||{}).length<185)
 throw Error('Prior verified catalog baseline missing/incompatible');
const paths=[...new Set(old.knownRoutes.map(pagePath).filter(Boolean))].sort();
if(paths.length<200)throw Error('Unexpected loss of established research pages: '+paths.length);
const findings=await pool(paths,8,getPage);
const bad=findings.filter(x=>x.error);
if(bad.length){
 console.log('SOURCE_ERRORS '+JSON.stringify({count:bad.length,samples:bad.slice(0,8)}));
 throw Error('Incomplete article scan: do not checkpoint or silently drop pages');
}
const now=Object.fromEntries(findings.map(x=>[x.url,x.value]));
if(mode==='seed'){
 if(fs.existsSync(file))throw Error('Existing article content checkpoint; never overwrite seed');
 const first=JSON.parse(fs.readFileSync('data/aquapedia-full-discord-sync-verified-20261015.json','utf8'));
 const second=JSON.parse(fs.readFileSync('data/aquapedia-remaining-sync-verified-20261015.json','utf8'));
 if(first.readbackPassed!==123||second.readbackPassed!==29||first.errors?.length||second.errors?.length)
  throw Error('Initial 152 Discord messages not verified; cannot initialize');
 const state={version:1,started:new Date().toISOString(),lastScan:new Date().toISOString(),pages:now,receipts:{},totalPosted:0};
 saveAtomically(state);
 console.log('ARTICLE_BASELINE_SEEDED '+JSON.stringify({pages:paths.length,bad:0,posted:0}));
 process.exitCode=0;
}else{
 if(!fs.existsSync(file))throw Error('Content baseline missing: first seed after 152 receipts');
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 if(state.version!==1)throw Error('Unsupported article checkpoint');
 const announcedCatalogPages=new Set(Object.values(old.receipts||{}).filter(x=>x.source&&x.id&&x.channel&&x.verifiedAt).map(x=>x.source));
 const changes=paths.filter(x=>!state.pages[x]||state.pages[x].digest!==now[x].digest);
 const alreadyAnnouncedNew=changes.filter(x=>!state.pages[x]&&announcedCatalogPages.has(x)).length;
 console.log('ARTICLE_CHECK '+JSON.stringify({mode,scanned:paths.length,changes:changes.length,
  newPages:changes.filter(x=>!state.pages[x]).length,alreadyAnnouncedNew,cap,queuedAfterPass:Math.max(0,changes.length-cap),
  examples:changes.slice(0,8)}));
 if(mode==='apply'&&changes.length){
  // Fail closed on site-wide template/render changes before connecting to Discord.
  guardArticleBulkChange(changes.length,paths.length);
  const guild=process.env.AQUAPHORIA_GUILD_ID,token=process.env.DISCORD_TOKEN;
  if(!guild||!token)throw Error('Existing private Aquaphoria bot auth required');
  const rest=new REST({version:'10'}).setToken(token);
  const [me,channels,active]=await Promise.all([
   rest.get(Routes.user('@me')),rest.get(Routes.guildChannels(guild)),
   rest.get(Routes.guildActiveThreads(guild))
  ]);
  const breeder=channels.find(x=>x.type===ChannelType.GuildCategory&&/BREEDER RESEARCH/i.test(x.name));
  const researcher=channels.find(x=>x.type===ChannelType.GuildCategory&&/AQUAPEDIA RESEARCH/i.test(x.name));
  if(!breeder||!researcher)throw Error('Required private breeder and research categories missing');
  for(const c of [breeder,researcher]){
   if(!(BigInt(c.permission_overwrites?.find(x=>x.id===guild)?.deny||0)&PermissionFlagsBits.ViewChannel))
    throw Error('Forum category privacy mismatch '+c.name);
  }
  const results=channels.find(x=>x.type===ChannelType.GuildText&&x.parent_id===researcher.id&&/research-results/i.test(x.name));
  const shrimps=channels.find(x=>x.type===ChannelType.GuildText&&/shrimp-guides/i.test(x.name));
  if(!results||!shrimps)throw Error('Existing destination channels missing');
  // Fail closed: every write destination must deny @everyone ViewChannel.
  // An explicit allow on a child overrides a private parent category.
  const privateDestination=c=>{
    const everyone=BigInt(c.permission_overwrites?.find(x=>x.id===guild)?.allow||0);
    const deny=BigInt(c.permission_overwrites?.find(x=>x.id===guild)?.deny||0);
    const parent=channels.find(x=>x.id===c.parent_id);
    const parentDeny=BigInt(parent?.permission_overwrites?.find(x=>x.id===guild)?.deny||0);
    const parentAllow=BigInt(parent?.permission_overwrites?.find(x=>x.id===guild)?.allow||0);
    const bit=PermissionFlagsBits.ViewChannel;
    if(everyone&bit)throw Error('PRIVACY_BLOCK explicit public destination '+c.name);
    if(!(deny&bit)&&(!(parentDeny&bit)||(parentAllow&bit)))
      throw Error('PRIVACY_BLOCK destination not proven private '+c.name);
  };
  // Guard only destinations used by THIS batch. Shrimp-guides is in the
  // public AQUAPEDIA category; never weaken its private-only publication gate.
  // Medaka-only updates must not be blocked by the unused shrimp destination.
  for(const kind of requiredChannelKinds(changes,cap)){
   privateDestination(kind==='shrimp'?shrimps:results);
  }
  const breederForums=channels.filter(x=>x.type===ChannelType.GuildForum&&x.parent_id===breeder.id);
  const threads=(active.threads||[]).filter(x=>breederForums.some(f=>f.id===x.parent_id));
  const catUrlToEntry=new Map();
  const currentCatalog=await fetch(base+'/assets/catalog.json',{signal:AbortSignal.timeout(12000)}).then(x=>x.json());
  for(const x of currentCatalog){
   if(pagePath(x.url))catUrlToEntry.set(x.url,x);
  }
  const cleanName=normalizeAquapediaArticleName;
  const dest=url=>{
    const x=catUrlToEntry.get(url);
    if(url.startsWith('/shrimpapedia/'))return shrimps.id;
    // Catalog labels must not override the URL's preflighted privacy class.
    if(x?.group==='shrimp')throw Error('Catalog group and approved article route disagree '+url);
    if(x){
     const candidates=threads.filter(t=>cleanName(t.name)===cleanName(x.name));
     if(candidates.length===1){
      const forum=breederForums.find(f=>f.id===candidates[0].parent_id);
      if(!forum)throw Error('Breeder research thread forum unavailable '+url);
      // Forum threads inherit permissions from their parent forum.
      privateDestination(forum);
      return candidates[0].id;
     }
    }
    return results.id;
  };
  let release;
  try{
   release=acquireArticleWriterLock(fs,lockFile,{pid:process.pid,mode,started:new Date().toISOString()});
  }catch(e){throw Error('Existing sync publisher holds shared writer lock: '+(e.code||e.message))}
  let posted=0,updated=0,unchanged=0,adopted=0;
  try{
   for(const url of changes.slice(0,cap)){
     const item=now[url];
     // Source URL already posted and verified by the metadata publisher; only establish future article-change tracking.
     if(!state.pages[url]&&announcedCatalogPages.has(url)){
       state.pages[url]=item;
       state.lastScan=new Date().toISOString();
       saveAtomically(state);
       adopted++;
       console.log('ARTICLE_ADOPTED_VERIFIED_CATALOG_RECEIPT '+url);
       continue;
     }
     const key='article-v1-'+hash(url).slice(0,22);
     const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
     const entry=catUrlToEntry.get(url);
     const summary=[
       ARTICLE_UPDATE_HEADING,
       '**Article:** '+(entry?.name||item.title),
       '**Change:** The published research article content was updated since the last verified Discord sync.',
       '**Source evidence and updated report:** '+base+url,
       '**Scope:** '+(entry?.summary||'Read the full article for its original source citations.').slice(0,260),
       '**Evidence:** Updated article content is not itself proof of DNA-verified lineage, breeder-original inventor status, or photographic reuse rights.',
       '**Photographs:** No externally owned images copied or uploaded.',
       mark
     ].join('\n');
     if(summary.length>1800)throw Error('Discord message oversize '+url);
     const payload=renderAquapediaCard(summary,{channel:url.startsWith('/shrimpapedia/')?'shrimp':'research'});
     const channel=dest(url),old=state.receipts[key];
     let message=null;
     if(old){
       if(!old.messageId||old.channel!==channel)
        throw Error('Prior article receipt channel mismatch; manual reconciliation required '+url);
       // A deleted/inaccessible old message must not silently become a new post.
       message=await rest.get(Routes.channelMessage(channel,old.messageId));
       if(!message||message.author?.id!==me.id||!message.content?.includes(mark))
        throw Error('Old receipt author or message marker mismatch '+url);
     }
     if(!message){
       const recent=await rest.get(Routes.channelMessages(channel),{query:new URLSearchParams({limit:'100'})});
       message=(recent||[]).find(v=>v.author?.id===me.id&&v.content?.includes(mark))||null;
     }
     let action='unchanged';
     if(!message||message.content!==payload.content||message.embeds?.[0]?.title!==payload.embeds?.[0]?.title||message.embeds?.[0]?.description!==payload.embeds?.[0]?.description){
       const existedBeforeWrite=Boolean(message);
       message=message
        ?await rest.patch(Routes.channelMessage(channel,message.id),{body:payload})
        :await rest.post(Routes.channelMessages(channel),{body:payload});
       action=articleWriteAction({previousReceipt:Boolean(old),existingMessage:existedBeforeWrite,changed:true});
     }
     if(!message||message.author?.id!==me.id||!message.content?.includes(mark)||(message.attachments||[]).length)
      throw Error('Discord write not acknowledged/readback failed '+url);
     state.pages[url]=item;
     state.receipts[key]={key,url,channel,messageId:message.id,digest:item.digest,
      action,lastVerified:new Date().toISOString()};
     state.totalPosted+=action==='unchanged'?0:1;
     state.lastScan=new Date().toISOString();
     saveAtomically(state);
     if(action==='posted')posted++;else if(action==='updated')updated++;else unchanged++;
     console.log('ARTICLE_VERIFIED '+JSON.stringify({url,action,channel,messageId:message.id}));
   }
  }finally{
   release();
  }
  console.log('ARTICLE_APPLY_DONE '+JSON.stringify({scanned:paths.length,pendingBefore:changes.length,
   posted,updated,unchanged,adopted,remaining:Math.max(0,changes.length-cap),cap,postedTotal:state.totalPosted}));

 }
}
