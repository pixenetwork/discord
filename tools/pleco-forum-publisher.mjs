// One-shot, readback-verified PUBLIC Aquapedia pleco forum publisher.
// Reuses the authorized Aquaphoria bot REST token, NO Gateway login or new scheduler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PLECO_BATCH2 } from './pleco-research-batch2.mjs';
import { PLECO_BATCH3 } from './pleco-research-batch3.mjs';
import { PLECO_BATCH4 } from './pleco-research-batch4.mjs';
import { Client, ClientUser, GatewayIntentBits, ChannelType, PermissionFlagsBits, ChannelFlags } from 'discord.js';

const GUILD_ID = '1519337502379475095';
const PARENT_ID = '1557338241903099945';
const PUBLIC_PARENT = '📚・AQUAPEDIA';
const FORUM_NAME = '🐟・pleco-research';
const GUIDE = 'START HERE — Plecopedia / L-number Research Index';
const SOURCE = 'https://github.com/pixenetwork/aquapedia/pull/21';
const PAPER25 = 'https://www.ni.bio.br/1982-0224-2024-0080/';
const PAPER05 = 'https://doi.org/10.1590/S1679-62252005000400011';
const SCOT = 'https://www.scotcat.com/help/faq1.htm';
const TAGS = ['Research index', 'Named species', 'L-number', 'Captive morph', 'Breeding', 'Breeder history', 'Taxonomy', 'Conservation', 'Needs review'];
const MARKER = 'AQP-PLECO-';
const RECEIPT = path.join(os.homedir(), 'AppData', 'Local', 'PixelNetwork', 'plecopedia-research-receipts-20261017.jsonl');

const sameGroup = 'The 2025 original species description places L066, L236, L287, L333, L399 and L400 under Hypancistrus seideli. Different historical appearance codes are not independently described species. Exact captive pedigree, founders and Mendelian inheritance remain unverified.';
export const records = [
 {id:'l046',title:'L046 — Zebra Pleco',kind:'Named species',name:'Hypancistrus zebra',area:'Middle rio Xingu / Volta Grande, Brazil',fact:'Formally described in 1991. Distinctive light body with black longitudinal stripes. In wild habitat, occupies narrow rock crevices in oxygenated Xingu rapids. Historical label L098 has also been associated with H. zebra, and must not be counted as an additional species.',breeding:'Cave-spawning Hypancistrus: use taxon-specific broodstock records; do not infer clutch or husbandry parameters from wild river measurements.',sources:[PAPER25,'https://www.scotcat.com/factsheets/hypancistrus_zebra.htm']},
 {id:'l098',title:'L098 — Historical Zebra Pleco identifier',kind:'L-number',name:'Hypancistrus zebra (historical alias)',area:'rio Xingu, Brazil',fact:'Hobby references associate historical L098 with Hypancistrus zebra L046. Maintain L098 as searchable code/appearance entry, not another formally described species.',breeding:'No independent L098 founding breeder or stable genetic inheritance established.',sources:['https://aquainfo.nl/en/l-numbers-and-lda-numbers-the-explanation/',PAPER25]},
 ...['066','236','287','333','399','400'].map(n=>({id:'l'+n,title:'L'+n+' — Hypancistrus seideli'+(n==='333'?' (King Tiger)':''),kind:'L-number',name:'Hypancistrus seideli',area:'Lower rio Xingu, Brazil',fact:sameGroup+' Original account explicitly cites this L'+n+' hobby designation and notes color-pattern variability across individuals and geography.',breeding:'Keep locality and founder/parent generation separately. Some seller line names have no demonstrated independent genetic ancestry.',sources:[PAPER25,'https://doi.org/10.1089/zeb.2015.1213']})),
 {id:'l174',title:'L174 — Hypancistrus yudja (Ozelot)',kind:'Named species',name:'Hypancistrus yudja',area:'Middle rio Xingu, Brazil',fact:'Formally described in 2025. Recorded in deeper (~15–40 m) lateritic rock formations, within the Belo Monte affected stretch; authors report severe conservation concern. Not a captive-selected derivative of L333.',breeding:'Published wild depth is habitat description, not an aquarium water-depth recommendation. Founder and breeding-line histories unresolved.',sources:[PAPER25]},
 {id:'l200-demantoides',title:'L200 — Baryancistrus demantoides (Green Phantom)',kind:'Named species',name:'Baryancistrus demantoides',area:'Upper Orinoco drainage, Venezuela',fact:'Formally described in 2005. Dorsal-fin membrane extends to join adipose fin, distinguishing it from Hemiancistrus subviridis. Both have appeared under the L200 trade code, but are different species.',breeding:'Species-specific care and documented captive-breeding records needed. Do not group all L200 stock as one species.',sources:[PAPER05]},
 {id:'l200-subviridis',title:'L200 — Hemiancistrus subviridis (Green Phantom)',kind:'Named species',name:'Hemiancistrus subviridis',area:'Orinoco / Casiquiare drainages, Venezuela',fact:'Described separately from Baryancistrus demantoides in 2005. Lacks the dorsal/adipose fin membrane connection. Historical L200 label applies to both species; identify by morphology and provenance.',breeding:'Do not combine stocks by shared L200 label without verified species identity.',sources:[PAPER05]},
 {id:'l018',title:'L018 / L085 / L177 — Gold Nugget',kind:'Named species',name:'Baryancistrus xanthellus',area:'rio Xingu and rio Iriri, Brazil',fact:'Gold Nugget plecos associated with multiple historical L-number descriptions; keep locality, spot appearance and trade code as separate specimen metadata rather than new species. L081 association needs explicit independent citation.',breeding:'Captive-bred vs wild-origin and actual breeder attribution not established for a specific line.',sources:['https://doi.org/10.1590/S1679-62252011000200001','https://aquainfo.nl/en/l-numbers-and-lda-numbers-the-explanation/']},
 {id:'l260',title:'L260 — Queen Arabesque',kind:'L-number',name:'Hypancistrus sp. L260',area:'rio Tapajós region, Brazil',fact:'L260 is a specialist hobby identifier for Queen Arabesque. Avoid treating it as an independently described scientific species or synonymizing it with visually similar forms absent a taxonomic source.',breeding:'Specialist husbandry describes male cave guarding; exact spawning parameters require breeder logs.',sources:['https://www.seriouslyfish.com/species/hypancistrus-sp-l260/']},
 {id:'l183',title:'L183 — Starlight Bristlenose',kind:'Named species',name:'Ancistrus dolichopterus',area:'Rio Negro basin, Brazil',fact:'A distinct bristlenose species, often mislabeled as ordinary domestic Ancistrus. Confirm dorsal-ray counts, seam coloring, and source locality in full specimen dossiers.',breeding:'Do not attribute common domestic longfin/albino origins to L183 without parentage documentation.',sources:['https://www.seriouslyfish.com/species/ancistrus-dolichopterus/']},
 ...[
 ['super-red','Super Red','Selection for red/orange pigmentation; no original creator or inheritance ratio verified.'],
 ['albino','Albino','Loss/reduction of dark pigment in domestic bristlenose phenotype; genetic mechanism must be evidenced per line.'],
 ['longfin','Longfin','Fin-length selection in domestic Ancistrus, not a distinct wild L-number or standalone species.'],
 ['calico','Calico','Multicolored domestic bristlenose phenotype; color-pattern segregation and lineage require breeder logs.']
 ].map(([id,title,note])=>({id:'morph-'+id,title:'Ancistrus captive morph — '+title,kind:'Captive morph',name:'Domestic Ancistrus line ('+title+')',area:'Captive/hobby origin; locality and initial founder unverified',fact:note+' Common domestic bristlenose stock is often taxonomically unresolved; do not automatically label it Ancistrus dolichopterus or assign L144.',breeding:'Requested evidence: named parent pair, breeder identity, F1/F2 outcomes, hatch dates, phenotype photographs, number of generations and selection criteria.',sources:['https://www.seriouslyfish.com/species/ancistrus-cf-cirrhosus/']})),
 {id:'wood-ecology',title:'Panaque / Panaqolus — Wood & diet evidence',kind:'Breeding',name:'Wood-associated loricariid dietary research',area:'Neotropical loricariids, studied taxa only',fact:'Research on wood-feeding loricariids warns against assuming these fish can digest cellulose efficiently enough for wood to be a complete ration. Food requirements vary with genus and species.',breeding:'Record observed feeding, gut condition, and successful grow-out; a decorative driftwood piece does not replace complete nutrition.',sources:['https://pmc.ncbi.nlm.nih.gov/articles/PMC2762535/']},
 {id:'ingo-seidel',title:'Breeder history — Ingo Seidel',kind:'Breeder history',name:'Ingo Seidel',area:'Germany / international pleco scholarship',fact:'The authors of the 2025 Hypancistrus seideli description named the species in honor of Ingo Seidel for decades of work on Hypancistrus care, breeding, books and lectures. Honorific naming does not prove he originated any particular color strain or L-number.',breeding:'Individual line-founder attribution requires direct breeder interview, lineage record or credible contemporaneous publication.',sources:[PAPER25]},
 {id:'taxonomy-primer',title:'L-number / LDA — Identity & provenance guide',kind:'Taxonomy',name:'L-number and LDA nomenclature',area:'Global aquarium trade / South American taxa',fact:'DATZ introduced the L-number scheme in December 1988 for loricariid identities. LDA was a separate aquarium-publication scheme. Historical numbers, named species, geographic populations, trade aliases and domestic morphs are different fields.',breeding:'Use scientific taxon → numbered alias → wild locality → captivity lineage → individual breeder/selection events, with cited links and uncertainty states.',sources:[SCOT]},
 ...PLECO_BATCH2,
 ...PLECO_BATCH3,
 ...PLECO_BATCH4,
];
function makePacket(r){
 const key=MARKER+r.id;
 const content=[
 '**Aquapedia Plecopedia • '+r.title+'**',
 '**Scientific / identity:** '+r.name,
 '**Location / origin:** '+r.area,
 '**Identity & diagnostic research:** '+r.fact,
 '**Breeding / provenance:** '+r.breeding,
 '**Current evidence:** Source-backed research draft. Independent Aegis/Cerberus review not yet verified. Unspecified breeders, genetics, awards and collection stock origin are not established.',
 '**Sources:** '+r.sources.map((s,i)=>'['+(i+1)+']('+s+')').join(' • '),
 '**Master dossier:** '+SOURCE,
 'No specimen photograph is published until reuse rights are documented.'
 ].join('\n');
 if(content.length>2000)throw Error('Discord content limit for '+r.id+': '+content.length);
 return {content,embeds:[{title:r.title,description:'Species / L-number / locality / captive-line distinctions are researched separately.',footer:{text:key+' • review pending'}}],allowedMentions:{parse:[]}};
}
function makeGuide(){
 const content='**START HERE — Plecopedia / L-number Research**\nPublic Aquapedia forum for pleco (Loricariidae) taxonomy, historical L/LDA numbers, named species, localities, breeding methods, captive selection, conservation, and breeder history.\n\n'
 +'A named species can have several hobby L-numbers, and one code can describe different species (L200). A domestic morph is not itself proof of a new species or known DNA inheritance.\n'
 +'**Current source-backed directory:** '+records.length+' standalone research topics; this is not the complete L-number catalog.\n'
 +'**Entry status:** Research draft, not independent Aegis/Cerberus approval. No copied/AI-generated animal photographs; rights review required.\n'
 +'**Canonical research:** '+SOURCE+'\n**Primary revision:** '+PAPER25+'\n**History:** '+SCOT;
 return {content,embeds:[{title:'Plecopedia — public research directory',description:'One searchable thread per L-number, recognized species or captive morph. Distinct aliases are cross-linked; not double-counted as valid species.',footer:{text:MARKER+'master-index • review pending'}}],allowedMentions:{parse:[]}};
}
const normalizeTitle=s=>String(s).normalize('NFKC').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function publicCheck(channel,guild){
 if(channel.permissionOverwrites.cache.size!==0)throw Error('Non-public Discord overwrites in '+channel.name);
 if(channel.permissionOverwrites.cache.has(guild.id))throw Error('@everyone has an override in '+channel.name);
}
async function listThreads(forum){
 const all=new Map();
 const active=await forum.threads.fetchActive();
 for(const t of active.threads.values())all.set(normalizeTitle(t.name),t);
 let before;
 for(let n=0;n<25;n++){
   const p=await forum.threads.fetchArchived(before?{limit:100,before}:{limit:100});
   for(const t of p.threads.values()){
     const key=normalizeTitle(t.name);
     if(all.has(key)&&all.get(key).id!==t.id)throw Error('Duplicate forum title: '+key);
     all.set(key,t);
   }
   if(!p.hasMore)return all;
   const last=[...p.threads.values()].at(-1);
   if(!last?.archivedAt|| (before&&last.archivedAt>=before))throw Error('Archive pagination not advancing');
   before=last.archivedAt;
 }
 throw Error('Archive enumeration limit; refusing publication');
}
function receipt(r){
 fs.mkdirSync(path.dirname(RECEIPT),{recursive:true});
 fs.appendFileSync(RECEIPT,JSON.stringify({at:new Date().toISOString(),...r,verified:true})+'\n');
}
async function main(){
 const apply=process.argv.includes('--apply');
 const limFlag=process.argv.find(v=>v.startsWith('--limit='));
 const limit=limFlag?Number(limFlag.split('=')[1]):12;
 if(!Number.isInteger(limit)||limit<0||limit>records.length)throw Error('Invalid limit');
 if(process.env.AQUAPHORIA_GUILD_ID!==GUILD_ID||!process.env.DISCORD_TOKEN)throw Error('Authorized existing Aquaphoria bot configuration absent or mismatched');
 const c=new Client({intents:[GatewayIntentBits.Guilds]});
 c.rest.setToken(process.env.DISCORD_TOKEN);
 try{
 const u=await c.rest.get('/users/@me');c.user=new ClientUser(c,u);
 const g=await c.guilds.fetch(GUILD_ID);await g.channels.fetch();await g.roles.fetch();
 const cat=g.channels.cache.get(PARENT_ID);
 if(!cat||cat.type!==ChannelType.GuildCategory||cat.name!==PUBLIC_PARENT)throw Error('Expected exact public Aquapedia category missing');
 publicCheck(cat,g);
 if(!g.roles.everyone.permissions.has(PermissionFlagsBits.ViewChannel))throw Error('Guild everyone cannot view public category');
 const candidates=[...g.channels.cache.values()].filter(v=>v.type===ChannelType.GuildForum&&v.name===FORUM_NAME);
 if(candidates.length>1|| (candidates.length===1&&candidates[0].parentId!==PARENT_ID))throw Error('Existing Pleco forum conflict');
 let forum=candidates[0];
 if(forum)publicCheck(forum,g);
 console.log(JSON.stringify({phase:'preflight',apply,guild:GUILD_ID,parent:PARENT_ID,existingForum:forum?.id||null,botId:u.id,selected:limit,totalCataloged:records.length,source:SOURCE}));
 if(!apply){
   if(process.argv.includes('--audit')){
     if(!forum)throw Error('Pleco public forum not present');
     const existing=await listThreads(forum);
     const wants=[{id:'master-index',title:GUIDE,packet:makeGuide()},...records.map(r=>({...r,packet:makePacket(r)}))];
     for(const item of wants){
       const thread=existing.get(normalizeTitle(item.title));
       if(!thread)throw Error('Missing live topic: '+item.title);
       const starter=await thread.fetchStarterMessage();
       if(starter?.author?.id!==u.id||starter.content!==item.packet.content||
          !starter.embeds?.some(e=>e.footer?.text?.startsWith(MARKER+item.id)))
         throw Error('Live starter is not exact/owned: '+item.id);
     }
     const pinned=await c.channels.fetch(existing.get(GUIDE).id,{force:true});
     if(!pinned.flags.has(ChannelFlags.Pinned))throw Error('Guide pin not verified');
     console.log(JSON.stringify({status:'live-audit-passed',forumId:forum.id,verifiedPosts:wants.length,indexPinned:true,publicForum:true,publicCategory:true}));
   }
   return;
 }
 if(!forum){
  forum=await g.channels.create({name:FORUM_NAME,type:ChannelType.GuildForum,parent:PARENT_ID,topic:'Public Aquapedia Plecopedia research: named species, L-numbers, localities, captive morphs and breeder history; citations, uncertainties and unlicensed-photo restrictions apply.',permissionOverwrites:[],availableTags:TAGS.map(name=>({name,moderated:false}))});
  const checked=await c.channels.fetch(forum.id,{force:true});
  if(checked?.parentId!==PARENT_ID||checked?.name!==FORUM_NAME||checked?.type!==ChannelType.GuildForum)throw Error('Forum creation readback failed');
  publicCheck(checked,g);
  receipt({action:'forum-created',guild:GUILD_ID,forumId:forum.id,categoryId:PARENT_ID});
  console.log(JSON.stringify({phase:'forum-created',id:forum.id}));
 }
 const existing=await listThreads(forum);
 const planned=[{id:'master-index',title:GUIDE,kind:'Research index',packet:makeGuide()},...records.slice(0,limit).map(r=>({...r,packet:makePacket(r)}))];
 let posted=0,present=0;
 for(const item of planned){
   const thread=existing.get(normalizeTitle(item.title));
   if(thread){
     const starter=await thread.fetchStarterMessage();
     if(starter?.author?.id!==u.id || !starter.embeds?.some(e=>e.footer?.text?.startsWith(MARKER+item.id)))throw Error('Title collision with unowned thread '+item.title);
     if(process.argv.includes('--refresh') && starter.content!==item.packet.content){
       await starter.edit(item.packet);
       const readback=await thread.messages.fetch({message:starter.id,force:true});
       if(readback?.author?.id!==u.id||readback.content!==item.packet.content||!readback.embeds?.some(e=>e.footer?.text?.startsWith(MARKER+item.id)))throw Error('Revision readback failed for '+item.id);
       const hash=createHash('sha256').update(readback.content).digest('hex');
       receipt({action:'revised',guild:GUILD_ID,forumId:forum.id,recordKey:item.id,threadId:thread.id,messageId:readback.id,contentHash:hash,source:SOURCE});
       console.log(JSON.stringify({action:'revised',id:item.id,threadId:thread.id}));
     } else console.log(JSON.stringify({action:'already-present',id:item.id,threadId:thread.id}));
     present++;
     continue;
   }
   const chosen=forum.availableTags.find(t=>t.name===item.kind);
   const review=forum.availableTags.find(t=>t.name==='Needs review');
   const tags=[chosen?.id,review?.id].filter(Boolean);
   const created=await forum.threads.create({name:item.title,message:item.packet,appliedTags:tags,reason:'User-approved source-attributed Aquapedia Pleco research'});
   const starter=await created.fetchStarterMessage();
   if(starter?.author?.id!==u.id||starter.content!==item.packet.content||!starter.embeds?.some(e=>e.footer?.text?.startsWith(MARKER+item.id)))throw Error('Discord write readback failed for '+item.id+'; stop before retry');
   const hash=createHash('sha256').update(starter.content).digest('hex');
   receipt({action:'posted',guild:GUILD_ID,forumId:forum.id,recordKey:item.id,threadId:created.id,messageId:starter.id,contentHash:hash,source:SOURCE});
   existing.set(normalizeTitle(item.title),created);
   posted++;
   console.log(JSON.stringify({action:'posted',id:item.id,url:'https://discord.com/channels/'+GUILD_ID+'/'+created.id}));
   await sleep(400);
 }
 const idx=existing.get(GUIDE);
 if(idx&&!idx.flags.has(ChannelFlags.Pinned)){
  await idx.pin('Public Plecopedia source index');
  const checked=await c.channels.fetch(idx.id,{force:true});
  if(!checked.flags.has(ChannelFlags.Pinned))throw Error('Index pin readback failed');
  receipt({action:'index-pinned',guild:GUILD_ID,forumId:forum.id,threadId:idx.id});
 }
 console.log(JSON.stringify({status:'verified-batch',posted,present,forumId:forum.id,sourceCount:records.length,receiptFile:RECEIPT}));
 }finally{c.destroy()}
}
if(import.meta.url===new URL('file:///'+process.argv[1].replaceAll('\\','/').replace(/^\/+/, '')).href){
 main().catch(e=>{console.error('PLECOPEDIA_STOP '+(e?.message||e));process.exitCode=1});
}
export {makeGuide,makePacket};