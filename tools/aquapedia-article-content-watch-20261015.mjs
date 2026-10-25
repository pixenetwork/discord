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
import {createHash,randomUUID} from 'node:crypto';
import {REST,Routes,ChannelType,PermissionFlagsBits} from 'discord.js';
import {renderAquapediaCard} from './aquapedia-post-card.mjs';
import {requiredChannelKinds,channelWriteCandidates} from './aquapedia-article-destination-policy.mjs';
import {resolveArticleReceiptChannel} from './aquapedia-article-receipt-channel.mjs';
import {assertTrackedRouteCoverage} from './aquapedia-article-route-integrity.mjs';
import {migratePrivateShrimpArticle,PRIVATE_SHRIMP_MIGRATION_ROUTES} from './aquapedia-private-shrimp-migration.mjs';

const migrateFlag=process.argv.includes('--migrate-shrimp-private');
if(migrateFlag&&(process.argv.includes('--seed')||process.argv.includes('--apply')))
 throw Error('Do not combine private migration with seed or regular apply');
const mode=migrateFlag?'migrate':process.argv.includes('--seed')?'seed':process.argv.includes('--apply')?'apply':'check';
const base='https://aquapedia.app';
const file=path.resolve('data/aquapedia-article-content-checkpoint.v1.json');
const lockFile=path.resolve('data/aquapedia-autosync-writer.lock');
const priorFile=path.resolve('data/aquapedia-autosync-state.v1.json');
const hash=x=>createHash('sha256').update(x).digest('hex');
const cap=50;
function saveAtomically(v){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 // A PID can be reused after a crash; never collide with an abandoned temp file.
 const tmp=file+'.tmp-'+process.pid+'-'+randomUUID();
 let created=false;
 try{
  fs.writeFileSync(tmp,JSON.stringify(v,null,2),{encoding:'utf8',flag:'wx'});
  created=true;
  fs.renameSync(tmp,file);
 }catch(e){
  if(created){
   try{fs.unlinkSync(tmp)}catch(cleanup){
    if(cleanup?.code!=='ENOENT')e.cleanupError=cleanup?.message;
   }
  }
  throw e;
 }
}
function pagePath(v){
 return typeof v==='string'&&/^\/(?:medakapedia|shrimpapedia|arowanapedia)\//.test(v)
  && !/\.\.|[?#<>"']/g.test(v)&&v.endsWith('/')?v:null;
}
function meaningful(main){
 // This is a digest normalizer, not a general-purpose HTML sanitizer.
 // Do not render its output. A scanner avoids overlapping replacement
 // patterns and recognizes whitespace in valid closing raw-text tags.
 const lower=main.toLowerCase();
 const kept=[];
 let cursor=0,spanStart=0;
 while(cursor<main.length){
  const lt=main.indexOf('<',cursor);
  if(lt<0)break;
  let skipEnd=-1;
  if(main.startsWith('<!--',lt)){
   const close=main.indexOf('-->',lt+4);
   if(close>=0)skipEnd=close+3;
  }else{
   for(const name of ['script','style']){
    if(!lower.startsWith('<'+name,lt))continue;
    const boundary=lower[lt+name.length+1]||'';
    if(boundary!=='>'&&boundary!=='/'&&!/\s/.test(boundary))continue;
    let openingEnd=-1,quote=null;
    for(let j=lt+name.length+1;j<main.length;j++){
     const ch=main[j];
     if(quote){if(ch===quote)quote=null}
     else if(ch==='"'||ch==="'")quote=ch;
     else if(ch==='>'){openingEnd=j;break}
    }
    if(openingEnd<0)continue;
    const closePrefix='</'+name;
    let close=lower.indexOf(closePrefix,openingEnd+1);
    while(close>=0){
     let k=close+closePrefix.length;
     while(k<main.length&&/\s/.test(main[k]))k++;
     if(main[k]==='>'){skipEnd=k+1;break}
     close=lower.indexOf(closePrefix,close+closePrefix.length);
    }
    if(skipEnd>=0)break;
   }
  }
  if(skipEnd>=0){
   kept.push(main.slice(spanStart,lt));
   spanStart=skipEnd;
   cursor=skipEnd;
  }else cursor=lt+1;
 }
 kept.push(main.slice(spanStart));
 return kept.join('').replace(/\s+/g,' ').trim();
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
const priorSnapshot=fs.readFileSync(priorFile,'utf8');
const old=JSON.parse(priorSnapshot);
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
 const checkpointSnapshot=fs.readFileSync(file,'utf8');
 const state=JSON.parse(checkpointSnapshot);
 if(state.version!==1)throw Error('Unsupported article checkpoint');
 // Every previously published article must still be scanned; catalog shrinkage
 // above the coarse route count floor cannot silently retire old receipts.
 assertTrackedRouteCoverage(paths,state.pages,state.receipts);
 const announcedCatalogPages=new Set(Object.values(old.receipts||{}).filter(x=>x.source&&x.id&&x.channel&&x.verifiedAt).map(x=>x.source));
 const changes=paths.filter(x=>!state.pages[x]||state.pages[x].digest!==now[x].digest);
 const workChanges=mode==='migrate'?changes.filter(url=>PRIVATE_SHRIMP_MIGRATION_ROUTES.includes(url)):changes;
 const alreadyAnnouncedNew=changes.filter(x=>!state.pages[x]&&announcedCatalogPages.has(x)).length;
 console.log('ARTICLE_CHECK '+JSON.stringify({mode,scanned:paths.length,changes:changes.length,
  newPages:changes.filter(x=>!state.pages[x]).length,alreadyAnnouncedNew,cap,queuedAfterPass:Math.max(0,changes.length-cap),
  examples:changes.slice(0,8)}));
 if((mode==='apply'||mode==='migrate')&&workChanges.length){
  if(mode==='migrate'
    &&process.env.AQUAPEDIA_PRIVATE_SHRIMP_MIGRATION_APPROVAL!=='JARVIS_GOVERNED_DISCORD64_PRIVATE_SHRIMP_20261024')
   throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK requires explicit governed release approval');
  const writeCandidates=channelWriteCandidates(workChanges,cap,state.pages,announcedCatalogPages,state.receipts);
  if(!writeCandidates.length){
   // Metadata-verified first-time pages have no article Discord writes. Do
   // not require channel lookup, bot authentication or REST for this branch.
   if(mode!=='apply')throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK no migration candidates');
   const adoptions=workChanges.slice(0,cap);
   for(const url of adoptions){
    const key='article-v1-'+hash(url).slice(0,22);
    if(state.pages[url]||state.receipts[key]||!announcedCatalogPages.has(url))
     throw Error('Unexpected pending or unverified article in adoption-only batch '+url);
   }
   let adoptionLock;
   try{
    adoptionLock=fs.openSync(lockFile,'wx');
    fs.writeSync(adoptionLock,JSON.stringify({pid:process.pid,mode,started:new Date().toISOString()}));
    if(fs.readFileSync(file,'utf8')!==checkpointSnapshot
      ||fs.readFileSync(priorFile,'utf8')!==priorSnapshot)
     throw Error('Article or metadata checkpoint changed during adoption preflight');
   }catch(e){
    if(adoptionLock!==undefined){
     try{fs.closeSync(adoptionLock)}finally{fs.unlinkSync(lockFile)}
    }
    throw Error('Cannot safely acquire adoption-only writer lock: '+(e.code||e.message));
   }
   try{
    for(const url of adoptions){
     state.pages[url]=now[url];
     state.lastScan=new Date().toISOString();
     saveAtomically(state);
     console.log('ARTICLE_ADOPTED_VERIFIED_CATALOG_RECEIPT '+url);
    }
   }finally{
    if(adoptionLock!==undefined){
     try{fs.closeSync(adoptionLock)}finally{fs.unlinkSync(lockFile)}
    }
   }
   console.log('ARTICLE_APPLY_DONE '+JSON.stringify({scanned:paths.length,pendingBefore:adoptions.length,
    posted:0,updated:0,unchanged:0,adopted:adoptions.length,remaining:Math.max(0,workChanges.length-cap),cap,postedTotal:state.totalPosted}));
  }else{
  const guild=process.env.AQUAPHORIA_GUILD_ID,token=process.env.DISCORD_TOKEN;
  if(!guild||!token)throw Error('Existing private Aquaphoria bot auth required');
  const rest=new REST({version:'10',retries:0}).setToken(token); // Never retry ambiguous message POSTs.
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
  // Live public shrimp-guides is not a private publication destination.
  // Use only the independently verified dedicated channel inside the research category.
  const shrimps=channels.find(x=>x.type===ChannelType.GuildText&&x.parent_id===researcher.id&&/shrimp-research-updates/i.test(x.name));
  const neededKinds=requiredChannelKinds(writeCandidates,cap);
  if((neededKinds.includes('research')&&!results)||(neededKinds.includes('shrimp')&&!shrimps))
   throw Error('Required private article write destination missing');
  // Fail closed: every write destination must deny @everyone ViewChannel.
  // An explicit allow on a child overrides a private parent category.
  const privateDestination=c=>{
    const everyone=BigInt(c.permission_overwrites?.find(x=>x.id===guild)?.allow||0);
    const deny=BigInt(c.permission_overwrites?.find(x=>x.id===guild)?.deny||0);
    const bit=PermissionFlagsBits.ViewChannel;
    if(everyone&bit)throw Error('PRIVACY_BLOCK explicit public destination '+c.name);
    // Discord child permissions are synced, not inherited. Parent-only denies
    // do not prove the destination itself has remained private.
    if(!(deny&bit))throw Error('PRIVACY_BLOCK destination lacks explicit deny '+c.name);
  };
  // Guard only destinations used by THIS batch. Shrimp-guides is in the
  // public AQUAPEDIA category; never weaken its private-only publication gate.
  // Medaka-only updates must not be blocked by the unused shrimp destination.
  for(const kind of neededKinds){
   privateDestination(kind==='shrimp'?shrimps:results);
  }
  const breederForums=channels.filter(x=>x.type===ChannelType.GuildForum&&x.parent_id===breeder.id);
  const threads=(active.threads||[]).filter(x=>breederForums.some(f=>f.id===x.parent_id));
  const catUrlToEntry=new Map();
  const currentCatalog=await fetch(base+'/assets/catalog.json',{signal:AbortSignal.timeout(12000)}).then(x=>x.json());
  for(const x of currentCatalog){
   if(pagePath(x.url))catUrlToEntry.set(x.url,x);
  }
  const cleanName=x=>String(x||'').normalize('NFKC').split(/[\\/|\u2014\u2013\uFF08(]/)[0]
   .replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase();
  const dest=url=>{
    const x=catUrlToEntry.get(url);
    if(url.startsWith('/shrimpapedia/')||x?.group==='shrimp'){
     privateDestination(shrimps); // Validate actual selected route, not only the URL-derived preflight.
     return shrimps.id;
    }
    if(x){
     const candidates=threads.filter(t=>cleanName(t.name)===cleanName(x.name));
     if(candidates.length===1){
       const forum=breederForums.find(f=>f.id===candidates[0].parent_id);
       if(!forum)throw Error('Selected breeder thread lost its parent forum '+url);
       // A forum may explicitly allow @everyone despite a private parent category.
       privateDestination(forum);
       return candidates[0].id;
     }
    }
    return results.id;
  };
  const resolveArchivedReceiptChannel=(receipt,proposedChannel,entry)=>
   resolveArticleReceiptChannel({
    receipt,proposedChannel,defaultChannel:results.id,entry,guild,breederForums,
    getChannel:id=>rest.get(Routes.channel(id)),
    privateDestination,cleanName,
    allowedThreadTypes:[ChannelType.PublicThread,ChannelType.PrivateThread],
   });
  let lock;
  try{
   lock=fs.openSync(lockFile,'wx');
   fs.writeSync(lock,JSON.stringify({pid:process.pid,mode,started:new Date().toISOString()}));
   // A previous publisher may finish between our source scan and lock acquisition.
   // Never publish using stale receipts or overwrite its newer checkpoint.
   if(fs.readFileSync(file,'utf8')!==checkpointSnapshot)
    throw Error('Article checkpoint changed during preflight; rerun complete check');
   if(fs.readFileSync(priorFile,'utf8')!==priorSnapshot)
    throw Error('Metadata baseline changed during preflight; rerun complete check');
  }catch(e){
   // If ownership metadata fails after exclusive creation, release only OUR lock.
   if(lock!==undefined){
    try{fs.closeSync(lock)}finally{fs.unlinkSync(lockFile)}
   }
   throw Error('Existing sync publisher could not acquire or record writer lock: '+(e.code||e.message));
  }
  let posted=0,updated=0,unchanged=0,adopted=0;
  try{
   for(const url of workChanges.slice(0,cap)){
     const item=now[url];
     // Source URL already posted and verified by the metadata publisher; only establish future article-change tracking.
     const key='article-v1-'+hash(url).slice(0,22);
     // A pending first-write intent must not be adopted as if publication succeeded.
     if(!state.pages[url]&&!state.receipts[key]&&announcedCatalogPages.has(url)){
       state.pages[url]=item;
       state.lastScan=new Date().toISOString();
       saveAtomically(state);
       adopted++;
       console.log('ARTICLE_ADOPTED_VERIFIED_CATALOG_RECEIPT '+url);
       continue;
     }
     const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
     const entry=catUrlToEntry.get(url);
     const summary=[
       '**AQUAPEDIA â€” UPDATED RESEARCH ARTICLE**',
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
     if(mode==='migrate'){
      const receipt=await migratePrivateShrimpArticle({
       url,key,mark,old,targetChannel:channel,rest,Routes,botId:me.id,
       payload,item,state,saveAtomically,
      });
      posted++;
      console.log('ARTICLE_PRIVATE_MIGRATED '+JSON.stringify(receipt));
      continue;
     }
     if(old&&old.channel!==channel)
      await resolveArchivedReceiptChannel(old,channel,entry);
     // Historical receipts retain their original channel only if an archived
     // guild thread passed the private-forum and article-identity checks.
     const targetChannel=old?.channel||channel;
     let message=null;
     if(old){
       // A recorded receipt is authoritative. Never reinterpret missing metadata,
       // a moved destination, or an API error as permission to create a new post.
       if(!old.messageId||old.channel!==targetChannel)
        throw Error('Old receipt missing message ID or channel mismatch '+url);
       message=await rest.get(Routes.channelMessage(targetChannel,old.messageId));
       if(!message||message.author?.id!==me.id||!message.content?.includes(mark))
        throw Error('Old receipt missing, author or message marker mismatch '+url);
     }
     if(!message){
       const recent=await rest.get(Routes.channelMessages(targetChannel),{query:new URLSearchParams({limit:'100'})});
       message=(recent||[]).find(v=>v.author?.id===me.id&&v.content?.includes(mark))||null;
     }
     if(!old){
       // Persist first-write intent before any external PATCH or POST.
       // If Discord accepts a write but readback/crash fails, the next run
       // sees this pending receipt and refuses a blind replacement post.
       state.receipts[key]={key,url,channel:targetChannel,messageId:message?.id||null,
        status:'pending',preparedAt:new Date().toISOString()};
       saveAtomically(state);
     }
     // Compare source links and evidence fields too; a title-only match is insufficient.
     const wanted=payload.embeds?.[0];
     const sameCard=seen=>{
       const card=seen?.embeds?.[0];
       const actualFields=card?.fields||[],expectedFields=wanted?.fields||[];
       // Discord may add rich "type"; do not accept hidden old images, extra
       // embeds, thumbnails or author/media metadata as a verified text card.
       if(!Array.isArray(seen?.embeds)||seen.embeds.length!==payload.embeds?.length
         ||!card||['image','thumbnail','video','author','provider','timestamp'].some(k=>card[k]!==undefined)
         ||(card.type!==undefined&&card.type!=='rich'))return false;
       return card.title===wanted?.title && card.description===wanted?.description
        && card.url===wanted?.url && card.color===wanted?.color
        && card.footer?.text===wanted?.footer?.text
        && actualFields.length===expectedFields.length
        && expectedFields.every((v,i)=>actualFields[i].name===v.name
         && actualFields[i].value===v.value && Boolean(actualFields[i].inline)===Boolean(v.inline));
     };
     let action='unchanged';
     if(!message||message.content!==payload.content||!sameCard(message)){
       const previous=message;
       message=previous
        ?await rest.patch(Routes.channelMessage(targetChannel,previous.id),{body:payload})
        :await rest.post(Routes.channelMessages(targetChannel),{body:payload});
       action=previous?'updated':'posted';
     }
     if(!message?.id||(old&&message.id!==old.messageId))
      throw Error('Discord write changed or omitted existing receipt ID '+url);
     // A PATCH/POST response is not independent readback. Fetch the persisted
     // message and validate the entire source-linked card before checkpointing.
     const confirmed=action==='unchanged'?message:await rest.get(Routes.channelMessage(targetChannel,message.id));
     if(!confirmed||confirmed.id!==message.id||confirmed.channel_id!==targetChannel
      ||confirmed.author?.id!==me.id||confirmed.content!==payload.content
      ||(confirmed.attachments||[]).length||!sameCard(confirmed))
      throw Error('Discord independent readback mismatch '+url);
     message=confirmed;
     state.pages[url]=item;
     state.receipts[key]={key,url,channel:targetChannel,messageId:message.id,digest:item.digest,
      action,lastVerified:new Date().toISOString(),
      // A future private PATCH must not erase the original public message proof.
      ...(old?.previousReceipt?{previousReceipt:old.previousReceipt}:{})};
     state.totalPosted+=action==='unchanged'?0:1;
     state.lastScan=new Date().toISOString();
     saveAtomically(state);
     if(action==='posted')posted++;else if(action==='updated')updated++;else unchanged++;
     console.log('ARTICLE_VERIFIED '+JSON.stringify({url,action,channel:targetChannel,messageId:message.id}));
   }
  }finally{
   if(lock!==undefined){
    try{fs.closeSync(lock)}finally{fs.unlinkSync(lockFile)}
   }
  }
  console.log('ARTICLE_APPLY_DONE '+JSON.stringify({scanned:paths.length,pendingBefore:changes.length,
   posted,updated,unchanged,adopted,remaining:Math.max(0,workChanges.length-cap),cap,postedTotal:state.totalPosted}));
  } // End Discord writer branch; adoption-only needs no network setup.
 }
}