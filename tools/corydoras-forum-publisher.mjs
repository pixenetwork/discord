import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  Client, ClientUser, GatewayIntentBits, ChannelType, ChannelFlags, PermissionFlagsBits,
  AttachmentBuilder
} from 'discord.js';

const SOURCE_SHA = '86446265ba4bdbf02a5beb4011d34e8843f545a9';
const SOURCE_PATH = 'research/inbox/perplexity/corydoras-history-species-localities-breeders.md';
const REPO = process.env.AQUAPEDIA_WORKTREE || path.join(os.homedir(), 'Aquapedia-Release-20261014');
const SOURCE_URL = 'https://github.com/pixenetwork/aquapedia/blob/' + SOURCE_SHA + '/' + SOURCE_PATH;
const PR_URL = 'https://github.com/pixenetwork/aquapedia/pull/20';
const SOURCE_CATEGORY = '🔬・AQUAPEDIA RESEARCH';
const CATEGORY = '🐟・CORYDORAS RESEARCH';
const FORUM = '🧬・species-and-strains';
const GUIDE_TITLE = 'START HERE — Corydoras Research Index';
const TAGS = ['Research index','Named species','C-number','CW-number','Captive strain','Breeding','Taxonomy','ID / Lookalikes','Needs review'];
const ALLOW_MENTIONS = { parse: [] };
const RECEIPT_FILE = path.join(os.homedir(), 'AppData', 'Local', 'PixelNetwork', 'corydoras-research-receipts.jsonl');

export const PRIORITY_NAMES = [
  'Hoplisoma sterbai', 'Hoplisoma panda', 'Hoplisoma adolfoi', 'Hoplisoma duplicareum',
  'Hoplisoma weitzmanii', 'Hoplisoma schwartzi', 'Hoplisoma tukano', 'Hoplisoma julii',
  'Hoplisoma trilineatum', 'Hoplisoma paleatum', 'Hoplisoma habrosum', 'Hoplisoma simile',
  'Hoplisoma concolor', 'Hoplisoma melini', 'Hoplisoma arcuatum', 'Hoplisoma metae',
  'Hoplisoma napoense', 'Hoplisoma gossei', 'Hoplisoma axelrodi', 'Hoplisoma leucomelas',
  'Osteogaster aenea', 'Osteogaster eques', 'Osteogaster melanotaenia',
  'Osteogaster sp. CW009', 'Osteogaster sp. CW010', 'Osteogaster sp. CW014',
  'Osteogaster sp. CW023', 'Brochis pantanalensis', 'Brochis splendens',
  'Brochis britskii', 'Brochis haraldschultzi', 'Brochis imitator',
  'Brochis leopardus', 'Brochis reticulata', 'Gastrodermus pygmaeus',
  'Gastrodermus hastatus', 'Gastrodermus elegans', 'Corydoras geoffroy',
  'Corydoras narcissus', 'Corydoras fowleri', 'Scleromystax barbatus',
  'Scleromystax kronei', 'Aspidoras pauciradiatus',
  'Corydoras sp. CW128', 'Corydoras sp. CW207',
];
const LINEAGE_NOTE = {
  'Corydoras sp. CW005': 'CW005 is the historical aquarium code for the described species Corydoras aurofrenatus (Eigenmann & Kennedy, 1903), according to the ScotCat specialist crosswalk; do not count the code as another distinct species.',
  'Corydoras aurofrenatus': 'Formally described species; historical CW005 / Corrientes trade code refers to the same fish, not a different species. Original type locality: Aguada near Arroyo Trementina, Paraguay (Eigenmann & Kennedy, 1903).',
  'Osteogaster oharai': 'Described in 2025 from the form previously designated CW068. Documented populations: rio Aripuanã (Madeira basin) and rio Juruena (Tapajós basin), Mato Grosso, Brazil. Distinctive oblique dark dorsolateral stripe.',
  'Osteogaster venezuelanus': 'TAXONOMY DISPUTED: Corydoras World lists this as a species, but Eschmeyer’s Catalog of Fishes currently treats the original C. venezuelanus as a synonym of O. aenea. This historical wild-origin name is NOT the captive-selected Black Venezuela line.',
  'Osteogaster schultzei': 'TAXONOMY UNCERTAIN: Eschmeyer’s Catalog of Fishes lists O. schultzei as uncertain; historically synonymized with O. aenea, with possible distinct status discussed. The commercially bred black schultzei-type strain is not itself a separate formal species.',
  'Hoplisoma sterbai': 'Sterba’s Cory; separate wild-type fish from any albino, black or longfin captive selections.',
  'Hoplisoma panda': 'Panda Cory; breeder-selected variants require independent parentage and inheritance evidence.',
  'Hoplisoma adolfoi': 'Upper Rio Negro orange-cap patterned species; compare with H. duplicareum and other mimics.',
  'Hoplisoma duplicareum': 'Distinguish from H. adolfoi using authoritative identification and source locality.',
  'Hoplisoma julii': 'True Julii identification often confused with H. trilineatum in the aquarium trade.',
  'Hoplisoma trilineatum': 'Three-line Cory; often incorrectly sold as true Julii.',
  'Hoplisoma habrosum': 'Salt-and-pepper dwarf Cory: genus Hoplisoma, not Gastrodermus.',
  'Gastrodermus pygmaeus': 'Pygmy Cory; distinct from the unrelated salt-and-pepper dwarf Cory.',
  'Gastrodermus hastatus': 'Tail-spot Cory; a separately described dwarf species.',
  'Osteogaster sp. CW009': 'Green Laser: numbered wild-origin identity; a selected Blue Laser line was reported from CW009 captive breeding.',
  'Osteogaster sp. CW010': 'Gold Laser: numbered identity; do not confuse the base population with a documented albino captive color morph.',
  'Osteogaster sp. CW014': 'Red Stripe code. Relationship to CW023 debated; preserve distinct historical code pending resolution.',
  'Osteogaster sp. CW023': 'Orange Stripe / Orange Laser code. Selected Red Laser offspring have been documented from CW023 breeding stock.',
  'Brochis pantanalensis': 'Pantanal Cory, historical C005; breeding coloration and sexual dimorphism merit separate coverage.',
  'Brochis haraldschultzi': 'Patterned Brochis often confused with Sterba’s Cory; require diagnostic comparison.',
  'Corydoras sp. CW128': 'UNRESOLVED coded form; the 2026 Tefé species description does NOT synonymize this with C. isaacisbrueckeri.',
  'Corydoras sp. CW207': 'UNRESOLVED coded form; the 2026 Tefé species description does NOT synonymize this with C. isaacisbrueckeri.'
};
const MORPHS = [
  {
    id:'morph-black-venezuela', name:'Black Venezuela / Black Cory',
    base:'Osteogaster aenea complex (schultzei-type captive line)',
    facts:'Captive-selected black line associated in specialist historical accounts with Hartmut Eberhardt in Germany in the early 1990s. "Venezuela" is an ambiguous trade name, not evidence this line was bred or collected there.',
    status:'Specialist historical account; taxon/early breeder provenance under review',
    sources:['https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/']
  },
  {
    id:'morph-blue-laser', name:'Blue Laser (CW009-selected)',
    base:'Osteogaster sp. CW009 Green Laser',
    facts:'Reported selectively bred blue phenotype derived from CW009 Green Laser stock by Ian Fuller. Do not treat as a separate named scientific species.',
    status:'Specialist breeder-history evidence; inheritance mechanism not established',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-red-laser', name:'Red Laser (CW023-selected)',
    base:'Osteogaster sp. CW023 Orange Stripe',
    facts:'A 2017 specialist account documents conspicuously red F2 offspring selectively reared from wild-origin CW023 stock. Preserve CW014 as a different historical code pending taxonomic reconciliation.',
    status:'Specialist breeder-history account; incomplete pedigree/genetics',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-albino-gold-laser', name:'Albino Gold Laser',
    base:'Osteogaster sp. CW010',
    facts:'An albino phenotype of Gold Laser has been reported in hobby breeder literature. Original creator, precise genetic mechanism and source stock are not verified here.',
    status:'Documented phenotype; lineage and genetics unverified',
    sources:['https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf']
  },
  {
    id:'morph-albino-sterbai', name:'Albino Sterbai',
    base:'Hoplisoma sterbai',
    facts:'Captive albino phenotype. Do not assign an invented breeder, origin date or simple inheritance ratio without breeding records.',
    status:'Captive trade morph; original provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/473']
  },
  {
    id:'morph-longfin-sterbai', name:'Longfin Sterbai',
    base:'Hoplisoma sterbai',
    facts:'Longfin trade phenotype: any assertion of a stable line, founder, or genotype must be supported by original breeder records.',
    status:'Trade morph claim; breed stability/provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/473']
  },
  {
    id:'morph-albino-bronze', name:'Albino Bronze Cory',
    base:'Osteogaster aenea complex',
    facts:'Captive pigment morph of bronze Cory stock; retain seller lineage and origin separately from the wild nominal species.',
    status:'Captive trade morph; first breeder/genetic locus not established',
    sources:['https://www.corydorasworld.com/lineages/fish/307']
  },
  {
    id:'morph-longfin-bronze', name:'Longfin Bronze Cory',
    base:'Osteogaster aenea complex',
    facts:'Longfin captive variant. The specific lineage and degree of fixation require individual breeder evidence.',
    status:'Captive trade morph; genetics/provenance unverified',
    sources:['https://www.corydorasworld.com/lineages/fish/307']
  },
];
function catalogFromSource(sourceText = null) {
  const text = sourceText ?? execFileSync('git',['-C',REPO,'show',SOURCE_SHA + ':' + SOURCE_PATH],{encoding:'utf8',maxBuffer:2_000_000});
  const re = /^\| ([^|]+) \| (Named taxon|C-coded|CW-coded) \| ([^|]+) \| \[CW source\]\((https:\/\/www\.corydorasworld\.com\/lineages\/fish\/\d+)\) \|$/gm;
  const all = [];
  const ids = new Set();
  for(const match of text.matchAll(re)) {
    const id=match[4].match(/\/(\d+)$/)[1];
    if(ids.has(id))throw new Error('Duplicate source record ID '+id);
    ids.add(id); all.push({ id, group:match[1],kind:match[2],name:match[3].trim(),source:match[4] });
  }
  if(all.length!==528)throw new Error('Expected 528 catalog entries, read '+all.length);
  return all;
}
function priorityRecords(catalog) {
  const byName=new Map(catalog.map(x=>[x.name.toLowerCase(),x]));
  const matches=[];
  const missing=[];
  for(const wanted of PRIORITY_NAMES) {
    const found=byName.get(wanted.toLowerCase());
    if(found) matches.push(found);
    else missing.push(wanted);
  }
  return {matches,missing};
}

// Dated-source discovery order, not a ranking by rarity or taxonomic confidence.
// Interleave source genera and named/C/CW record classes in bounded batches.
function nextCatalogBatch(catalog, occupiedNames, limit) {
  if(!Number.isInteger(limit)||limit<1||limit>80)throw new Error('Next batch size must be 1 to 80');
  const occupied=new Set([...occupiedNames].map(name=>String(name).trim().toLowerCase()));
  const seen=new Set();
  const groups=[...new Set(catalog.map(item=>item.group))];
  const kinds=['Named taxon','CW-coded','C-coded'];
  const pools=new Map();
  for(const group of groups){
    for(const kind of kinds){
      pools.set(group+'::'+kind,catalog.filter(item=>item.group===group&&item.kind===kind&&!occupied.has(item.name.toLowerCase())));
    }
  }
  const results=[];
  while(results.length<limit){
    let advanced=false;
    for(const kind of kinds){
      for(const group of groups){
        const item=pools.get(group+'::'+kind).shift();
        if(!item)continue;
        advanced=true;
        const key=item.name.toLowerCase();
        if(seen.has(key))throw new Error('Duplicate directory display label: '+item.name);
        seen.add(key);
        results.push(item);
        if(results.length>=limit)return results;
      }
    }
    if(!advanced)break;
  }
  return results;
}
function safe(s,limit=350){return String(s??'').replace(/@(here|everyone)/ig,'@\u200b$1').slice(0,limit);}
function kindTag(kind){return kind==='Named taxon'?'Named species':kind==='C-coded'?'C-number':'CW-number';}
const CONTESTED_NAMED_TAXA = new Set(['Osteogaster venezuelanus','Osteogaster schultzei']);
function nameClassification(rec){return rec.name==='Brochis Taiosh'?'Unverified directory name':CONTESTED_NAMED_TAXA.has(rec.name)?'Contested taxonomic status':kindTag(rec.kind);}
// Only attach these species-specific assertions where traceable specialist or
// original taxonomic sources have been checked. Habitat data are NOT tank targets.
const SPECIES_EVIDENCE = {
  'Corydoras aurofrenatus': [
    '**Names and lineage:** Original described name Corydoras aurofrenatus Eigenmann & Kennedy, 1903. CW005 and Corrientes are historical identification aliases, not separate taxa.',
    '**Origin and identification:** Type locality Aguada near Arroyo Trementina, Paraguay; long-snouted, with two dark flank blotches and an elongated upper caudal lobe.',
    '**Field / care:** Reported from the Paraguay–Paraná drainage. ScotCat suggests fine sand and a varied sinking diet; published species-specific breeding protocol is not confirmed here.',
    '**Taxonomic verification:** https://www.scotcat.com/callichthyidae/c_aurofrenatus.htm ; https://www.seriouslyfish.com/species/corydoras-aurofrenatus/ ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Corydoras&tbl=species'
  ],
  'Osteogaster oharai': [
    '**Names and lineage:** Described by Tencatt, Carvalho, Silva & Britto (2025), after previously appearing in the trade as CW068. CW068 is a historical alias, not a second new species.',
    '**Identity:** Oblique, dark dorsolateral flank stripe; the original description contrasts fin, bone and pigment characters with congeneric species.',
    '**Documented locality:** Rio Aripuanã drainage of the Madeira basin and rio Juruena drainage of the Tapajós basin, Mato Grosso, Brazil.',
    '**Habitat observed in the wild:** Small/shallow streams or intermittent pools with marginal vegetation, sand/clay, leaf litter, logs and dark water in the Juruena basin. These observations are NOT validated aquarium water targets.',
    '**Breeding / genealogy:** No named original captive-line breeder or proven strain inheritance from these sources; do not attribute wild scientific discovery to a hobby breeder.',
    '**Original description:** https://www.ni.bio.br/1982-0224-2024-0134/ ; https://www.scotcat.com/callichthyidae/osteogaster_oharai.htm'
  ],
  'Osteogaster venezuelanus': [
    '**Taxonomic conflict:** The 2026 Eschmeyer Catalog of Fishes currently treats Corydoras venezuelanus Ihering, 1911 as a synonym of Osteogaster aenea. Specialist Corydoras World and ScotCat retain the historical name as a distinguishable hobby population/species. Do not claim consensus validity.',
    '**Historic type locality:** Río Cabriales, Valencia, Carabobo, Venezuela (original name from Ihering, 1911). This locality does NOT describe the separately developed commercial black line.',
    '**Black-line distinction:** The captive selected Black Venezuela / schultzei-black trade line was developed in Germany; it should not be confused with wild orange-shouldered venezuelanus-type populations.',
    '**Evidence:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=4920 ; https://www.scotcat.com/callichthyidae/osteogaster_venezuelanus.htm ; https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/'
  ],
  'Osteogaster schultzei': [
    '**Taxonomic conflict:** The Eschmeyer Catalog labels the original schultzei species status uncertain; historically synonymized with Osteogaster aenea but discussed as potentially valid. Never count it as a confidently distinct named species without taxonomic review.',
    '**Captive trait distinction:** The domestically selected black schultzei-type line is a separate strain-history question; specialist Ian Fuller reports early 1990s German line selection by Hartmut Eberhardt.',
    '**Evidence:** https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Osteogaster&tbl=species ; https://www.practicalfishkeeping.co.uk/features/the-legend-of-the-cory/'
  ]
};
function sourcePacket(rec) {
  const extra=rec.name.includes('CW128')||rec.name.includes('CW207')
    ? '\n**2026 original taxonomy:** https://doi.org/10.1590/1982-0224-2025-0146'
    : rec.name==='Corydoras sp. CW005'
      ? '\n**CW005 crosswalk:** https://www.scotcat.com/callichthyidae/c_aurofrenatus.htm'
      : '';
  const directoryWarning=rec.name==='Brochis Taiosh'
    ? 'Source directory label is not a validated Latin binomial; its formal species or trade identity remains unresolved.'
    : rec.name.startsWith('Osteogasters ')
      ? 'Source directory appears to contain a genus spelling inconsistency. Retain the original listing for traceability, but confirm the accepted name.'
      : '';
  const note=LINEAGE_NOTE[rec.name] || 'Taxonomy, type locality, local population, captive pedigree, and breeding data require record-level review.';
  return {
    content: [
      '**' + safe(rec.name,100) + '**',
      '**Classification:** ' + nameClassification(rec) + ' | **Research genus group:** ' + safe(rec.group,30),
      ...(directoryWarning?['**Naming caution:** ' + directoryWarning]:[]),
      '**Status:** Research draft / verification pending. A C/CW identifier is NOT necessarily a different species or domestic strain.',
      '**Identity / notes:** ' + safe(note,350),
      '**Breeder / founder:** Not established from this index.',
      '**Care / breeding:** Species-specific parameters not yet independently validated unless documented directly below.',
      ...(SPECIES_EVIDENCE[rec.name] ?? []),
      '**Source record:** ' + rec.source + extra,
      '**Aquapedia dossier:** ' + PR_URL
    ].join('\n'),
    embeds:[{title:safe(rec.name,100),description:'Aquapedia provisional catalog entry; do not interpret unresolved taxonomy or trade identity as proven genetics.',footer:{text:'AQP-CORY-' + rec.id + ' • research draft'}}],
    allowedMentions: ALLOW_MENTIONS,
  };
}
function morphPacket(rec) {
  return {
    content:[
      '**' + safe(rec.name,100) + '**',
      '**Record type:** Captive morph / selected line (not automatically a scientific species).',
      '**Underlying fish:** ' + rec.base,
      '**What is documented:** ' + rec.facts,
      '**Evidence status:** ' + rec.status,
      '**Breeding / genetics:** Original pedigree and inheritance must be independently checked unless explicitly documented above.',
      '**Sources:** ' + rec.sources.join(' '),
      '**Aquapedia dossier:** ' + PR_URL
    ].join('\n'),
    embeds:[{title:safe(rec.name,100),description:'Captive form record, with founder/parentage claims clearly bounded.',footer:{text:'AQP-CORY-' + rec.id + ' • research draft'}}],
    allowedMentions: ALLOW_MENTIONS
  };
}
function guidePacket(catalog) {
  const csv = ['group,classification,name,source'].concat(catalog.map(r=>[r.group,r.kind,r.name,r.source].map(x=>'"'+x.replaceAll('"','""')+'"').join(','))).join('\r\n');
  return {
    content:[
      '**Corydoras Research — master index (2026-10-16 snapshot)**',
      '528 specialist-directory listings: 219 named labels, 112 C-number listings and 197 CW-number listings. These are **not** 528 confirmed species or domestic strains.',
      'One forum post per researched fish or captive morph; tags distinguish species, coded forms, and breeder-selected traits. Research drafts are not final taxonomy.',
      '**What each entry needs:** current and historical names, identity and diagnostic photos, basin/locality, genetics/lineage where known, water/husbandry and breeding methods, breeder origin, confidence and independent citations.',
      '**Research dossier / source crosswalk:** ' + SOURCE_URL,
      '**Draft review:** ' + PR_URL,
      '**Copyright:** No third-party fish photography or articles republished without documented permission. No private source-server links.',
      'The attached CSV contains all 528 initial source entries; threads are seeded only as findings are reviewed.'
    ].join('\n'),
    files:[new AttachmentBuilder(Buffer.from(csv,'utf8'),{name:'aquapedia-corydoras-public-index-528.csv'})],
    embeds:[{title:'Corydoras Research — START HERE',description:'Species and strain research, taxonomy notes, C/CW identities and breeding evidence.',footer:{text:'AQP-CORY-master-index-528 • research draft'}}],
    allowedMentions:ALLOW_MENTIONS
  };
}
function perms(ch) {
  return [...ch.permissionOverwrites.cache.values()].map(x=>({id:x.id,type:x.type,allow:x.allow.bitfield,deny:x.deny.bitfield}));
}
function requirePrivacy(ch,guildId) {
  const everyone=ch.permissionOverwrites.cache.get(guildId);
  if(!everyone?.deny.has(PermissionFlagsBits.ViewChannel))throw new Error('Research category lacks explicit @everyone ViewChannel denial: '+ch.name);
}
async function ensureChannel(guild, sourceCategory, doApply) {
  const list=[...guild.channels.cache.values()];
  const sameCat=list.filter(c=>c.type===ChannelType.GuildCategory && c.name===CATEGORY);
  if(sameCat.length>1)throw new Error('Ambiguous duplicate Corydoras categories');
  let category=sameCat[0];
  if(category)requirePrivacy(category,guild.id);
  if(!category && doApply){
    category=await guild.channels.create({name:CATEGORY,type:ChannelType.GuildCategory,
      permissionOverwrites:perms(sourceCategory),reason:'Approved Aquapedia Corydoras forum classification'});
    requirePrivacy(category,guild.id);
  }
  const sameForum=list.filter(c=>c.type===ChannelType.GuildForum && c.name===FORUM && (!category||c.parentId===category.id));
  if(sameForum.length>1)throw new Error('Ambiguous duplicate Corydoras forums');
  let forum=sameForum[0];
  if(forum) {
    if(forum.parentId!==category.id)throw new Error('Corydoras forum parent mismatch');
    requirePrivacy(forum,guild.id);
  }
  if(!forum && doApply){
    if(!category)throw new Error('Missing research category');
    forum=await guild.channels.create({
      name:FORUM,type:ChannelType.GuildForum,parent:category.id,
      topic:'Private Aquapedia Corydoras species, C/CW-numbered forms and documented breeder-selected strains. Research drafts clearly tagged. No unlicensed images.',
      availableTags:TAGS.map(name=>({name,moderated:false})),
      permissionOverwrites:perms(category),
      reason:'User-approved Corydoras research forum'
    });
    requirePrivacy(forum,guild.id);
  }
  return {category,forum};
}
async function allThreads(forum) {
  const active=await forum.threads.fetchActive();
  const found=new Map([...active.threads.values()].map(x=>[x.name,x]));
  let before=null;
  for(let page=0;page<25;page++){
    const archive=await forum.threads.fetchArchived(before?{limit:100,before}:{limit:100});
    for(const thread of archive.threads.values()){
      if(found.has(thread.name)&&found.get(thread.name).id!==thread.id)throw new Error('Duplicate thread title: '+thread.name);
      found.set(thread.name,thread);
    }
    if(!archive.hasMore)return found;
    const oldest=[...archive.threads.values()].at(-1);
    if(!oldest?.archivedAt || (before && oldest.archivedAt >= before))throw new Error('Archived thread pagination blocked');
    before=oldest.archivedAt;
  }
  throw new Error('Archived forum search exceeded 25 pages; fail closed');
}
function tagIds(forum,names) {
  return names.map(name=>forum.availableTags.find(t=>t.name===name)?.id).filter(Boolean);
}
async function post(forum,recordKey,name,payload,tags,known,botId,kind) {
  const thread=known.get(name);
  const marker='AQP-CORY-' + recordKey;
  if(thread){
    const starter=await thread.fetchStarterMessage();
    if(starter?.author?.id !== botId || !starter.embeds.some(e=>e.footer?.text?.startsWith(marker))){
      throw new Error('Existing thread title is not safely owned by this publisher: '+name);
    }
    return {action:'already-present',recordKey,threadId:thread.id,messageId:starter.id};
  }
  const created=await forum.threads.create({name,message:payload,appliedTags:tagIds(forum,tags),reason:'User-approved Aquapedia Corydoras research'});
  const starter=await created.fetchStarterMessage();
  if(!starter?.id || starter.author.id!==botId || !starter.embeds.some(e=>e.footer?.text?.startsWith(marker))){
    throw new Error('Discord write cannot be confirmed; stop for recovery audit: '+name);
  }
  known.set(name,created);
  fs.mkdirSync(path.dirname(RECEIPT_FILE),{recursive:true});
  fs.appendFileSync(RECEIPT_FILE,JSON.stringify({at:new Date().toISOString(),sourceSha:SOURCE_SHA,guildId:forum.guild.id,forumId:forum.id,kind,recordKey,threadId:created.id,messageId:starter.id,verified:true})+'\n');
  return {action:'posted',recordKey,threadId:created.id,messageId:starter.id};
}
// Permit a bounded correction to a bot-owned research starter post without duplicating it.
async function refreshRecord(forum, threads, rec, botId, receiptFile=RECEIPT_FILE) {
  const thread=threads.get(rec.name);
  if(!thread)throw new Error('Cannot refresh missing research thread: '+rec.name);
  const marker='AQP-CORY-'+rec.id;
  const starter=await thread.fetchStarterMessage();
  if(!starter?.id||starter.author?.id!==botId||!starter.embeds?.some(e=>e.footer?.text?.startsWith(marker)))
    throw new Error('Research source ownership/marker mismatch; refusing edit: '+rec.name);
  const payload=sourcePacket(rec);
  const changed=starter.content!==payload.content;
  if(changed)await starter.edit(payload);
  const readback=await thread.messages.fetch({message:starter.id,force:true});
  if(readback?.author?.id!==botId||readback.content!==payload.content||!readback.embeds?.some(e=>e.footer?.text?.startsWith(marker)))
    throw new Error('Refresh readback failed. Stop before retry: '+rec.name);
  let tagChanged=false;
  if(CONTESTED_NAMED_TAXA.has(rec.name)){
    const desired=tagIds(forum,['Taxonomy','Needs review']);
    if(desired.length!==2)throw new Error('Contested taxon tags missing from forum; refusing metadata edit');
    const current=[...(thread.appliedTags??[])];
    if(desired.length!==current.length||desired.some(id=>!current.includes(id))){
      if(typeof thread.setAppliedTags!=='function')throw new Error('Missing forum thread tag edit permission');
      await thread.setAppliedTags(desired,'Mark contested Corydoras taxonomy as research only');
      tagChanged=true;
    }
    const checked=await thread.fetch(true);
    if(!desired.every(id=>checked.appliedTags?.includes(id))||checked.appliedTags.length!==desired.length)
      throw new Error('Contested taxon tags could not be verified after edit: '+rec.name);
  }
  const contentHash=createHash('sha256').update(readback.content).digest('hex');
  let alreadyReceipted=false;
  if(fs.existsSync(receiptFile)){
    const raw=fs.readFileSync(receiptFile,'utf8');
    alreadyReceipted=raw.split(/\r?\n/).filter(Boolean).some(line=>{
      const previous=JSON.parse(line);
      return previous.kind==='revision'&&previous.recordKey===rec.id&&previous.threadId===thread.id&&previous.contentHash===contentHash&&previous.verified===true;
    });
  }
  if(!alreadyReceipted||tagChanged){
    fs.mkdirSync(path.dirname(receiptFile),{recursive:true});
    fs.appendFileSync(receiptFile,JSON.stringify({at:new Date().toISOString(),action:changed?'updated':tagChanged?'retagged':'reconciled',tagChanged,contentHash,sourceSha:SOURCE_SHA,guildId:forum.guild.id,forumId:forum.id,kind:'revision',recordKey:rec.id,threadId:thread.id,messageId:readback.id,verified:true})+'\n');
  }
  return {action:changed?'updated':tagChanged?'retagged':alreadyReceipted?'unchanged':'reconciled',recordKey:rec.id,threadId:thread.id,messageId:readback.id,verified:true};
}

async function main() {
  const mode=process.argv.includes('--apply')?'apply':'plan';
  const nextFlag=process.argv.find(a=>a.startsWith('--next='));
  const refreshFlag=process.argv.find(a=>a.startsWith('--refresh-id='));
  const refreshId=refreshFlag?.split('=')[1]??null;
  if(refreshFlag && (!/^[0-9]+$/.test(refreshId)||nextFlag))
    throw new Error('--refresh-id requires a numerical source ID and cannot accompany --next');
  const nextCount=nextFlag?Number(nextFlag.split('=')[1]):null;
  if(nextFlag && (!Number.isInteger(nextCount)||nextCount<1||nextCount>80))
    throw new Error('--next must contain 1 to 80 unpublished directory records');
  const limitFlag=process.argv.find(a=>a.startsWith('--limit='));
  const limit=limitFlag?Number(limitFlag.split('=')[1]):36;
  if(!Number.isInteger(limit)||limit<0||limit>80)throw new Error('--limit must be between 0 and 80');
  const guildId=process.env.AQUAPHORIA_GUILD_ID;
  const token=process.env.DISCORD_TOKEN;
  if(!guildId||!token)throw new Error('Existing authorized Discord bot configuration is missing');
  const catalog=catalogFromSource(), selected=priorityRecords(catalog);
  const client=new Client({intents:[GatewayIntentBits.Guilds]});
  client.rest.setToken(token);
  try{
    const user=await client.rest.get('/users/@me');
    client.user=new ClientUser(client,user);
    const guild=await client.guilds.fetch(guildId);
    await guild.channels.fetch();
    const sources=[...guild.channels.cache.values()].filter(c=>c.type===ChannelType.GuildCategory && c.name===SOURCE_CATEGORY);
    if(sources.length!==1)throw new Error('Exact private Aquapedia research source category not found unambiguously');
    requirePrivacy(sources[0],guild.id);
    const target=await ensureChannel(guild,sources[0],mode==='apply'&&!nextFlag&&!refreshFlag);
    console.log(JSON.stringify({mode,guildId:guild.id,botId:user.id,category:target.category?.name||'(would create)',forum:target.forum?.name||'(would create)',sourceCount:catalog.length,priorityMatched:selected.matches.length,priorityMissing:selected.missing,uniqueMorphs:MORPHS.length,plannedPosts:process.argv.includes('--pin-guide')?0:(refreshFlag?1:(nextFlag?nextCount:Math.min(limit,selected.matches.length)+MORPHS.length+1))}));
    if(mode==='plan'&&!nextFlag&&!refreshFlag)return;
    const forum=target.forum;
    if(!forum)throw new Error('No forum returned after provisioning');
    const existing=await allThreads(forum);
    const nextSelection=nextFlag?nextCatalogBatch(catalog,new Set(existing.keys()),nextCount):[];
    if(nextFlag)console.log(JSON.stringify({nextBatchPreview:nextSelection.map(r=>({name:r.name,kind:r.kind,source:r.source})),selectionCount:nextSelection.length,existingThreads:existing.size}));
    const refreshRec=refreshFlag?catalog.find(r=>r.id===refreshId):null;
    if(refreshFlag) {
      if(!refreshRec)throw new Error('Unknown directory ID: '+refreshId);
      if(!existing.has(refreshRec.name))throw new Error('Target thread not found: '+refreshRec.name);
      console.log(JSON.stringify({refreshPreview:{id:refreshRec.id,name:refreshRec.name,source:refreshRec.source}}));
    }
    if(mode==='plan')return;
    if(refreshRec){
      console.log(JSON.stringify(await refreshRecord(forum,existing,refreshRec,user.id)));
      return;
    }
    if(process.argv.includes('--pin-guide')) {
      const guide=existing.get(GUIDE_TITLE);
      if(!guide)throw new Error('Research master index thread does not exist');
      const starter=await guide.fetchStarterMessage();
      if(starter?.author?.id!==user.id || !starter.embeds.some(e=>e.footer?.text?.startsWith('AQP-CORY-master-index-528')))
        throw new Error('Cannot pin guide without validated bot-authored index');
      if(!guide.flags.has(ChannelFlags.Pinned))await guide.pin('Keep the Aquapedia Corydoras source index discoverable');
      const confirmed=await client.channels.fetch(guide.id,{force:true});
      if(!confirmed?.flags.has(ChannelFlags.Pinned))throw new Error('Guide pin could not be verified');
      console.log(JSON.stringify({status:'guide-pinned',threadId:guide.id,forumId:forum.id,verified:true}));
      return;
    }
    let posted=0,present=0;
    const choices=nextFlag
      ? nextSelection.map(rec=>({key:rec.id,name:rec.name,payload:sourcePacket(rec),tags:[rec.name==='Brochis Taiosh'||CONTESTED_NAMED_TAXA.has(rec.name)?'Taxonomy':kindTag(rec.kind),'Needs review'],kind:'directory'}))
      : [
        {key:'master-index-528',name:GUIDE_TITLE,payload:guidePacket(catalog),tags:['Research index','Taxonomy'],kind:'index'},
        ...selected.matches.slice(0,limit).map(rec=>({key:rec.id,name:rec.name,payload:sourcePacket(rec),tags:[kindTag(rec.kind),'Needs review'],kind:'directory'})),
        ...MORPHS.map(rec=>({key:rec.id,name:rec.name,payload:morphPacket(rec),tags:['Captive strain','Needs review'],kind:'morph'})),
      ];
    for(const item of choices){
      const receipt=await post(forum,item.key,item.name,item.payload,item.tags,existing,user.id,item.kind);
      if(receipt.action==='posted')posted++;else present++;
      console.log(JSON.stringify(receipt));
    }
    console.log(JSON.stringify({status:'completed',posted,present,forumId:forum.id,categoryId:target.category.id,receiptFile:RECEIPT_FILE}));
  } finally { client.destroy(); }
}
if(import.meta.url===new URL('file://' + process.argv[1].replaceAll('\\','/')).href){
  main().catch(error=>{console.error('STOP',error?.message||String(error));process.exitCode=1;});
}
export {catalogFromSource,priorityRecords,nextCatalogBatch,sourcePacket,morphPacket,guidePacket,refreshRecord,TAGS,MORPHS};
