import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { publishVerifiedBreederPublicBatch, VERIFIED_BREEDER_ROUTES } from '../src/verified-breeder-public-batch.mjs';

const queue = JSON.parse(readFileSync(new URL('./fixtures-verified-breeders.json', import.meta.url), 'utf8'));
const originalCards = queue.cards;
function fixture({
  omitTarumi = false, duplicateTarumi = false, hidden = false,
  noBotWrite = false, wrongCategory = false, failArchive = false,
  failReadback = false,
} = {}) {
  const sends = [], creates = [];
  let sequence = 0;
  const ids = { tarumi: 'medaka-tarumi', savanna: 'medaka-savanna' };
  const mkThread = (name, id, starter = null) => {
    const messages = new Map();
    if (starter) messages.set('seed-'+id, { id:'seed-'+id, author:{id:'human'}, content:'Original breeder directory index', embeds:[] });
    return {
      id, name, archived:false, messages: {
        async fetch(arg) {
          if (typeof arg === 'string') {
            if (failReadback && String(arg).startsWith('message-')) throw Error('unknown readback');
            return messages.get(arg);
          }
          return new Map([...messages.entries()].reverse());
        }
      },
      async send(payload) {
        const result = {id:'message-'+(++sequence),author:{id:'our-bot'}, content:payload.content, embeds:payload.embeds};
        messages.set(result.id,result);
        sends.push({threadName:name,threadId:id,payload,result});
        return result;
      },
      async fetchStarterMessage(){ return [...messages.values()].at(-1); },
      async setArchived(){ throw Error('Not allowed'); }
    };
  };
  const activeMedaka = new Map();
  if(!omitTarumi)activeMedaka.set(ids.tarumi,mkThread('BREEDER - Masaharu Tarumi ???',ids.tarumi,true));
  activeMedaka.set(ids.savanna,mkThread('BREEDER - Medaka-ya Savanna ?????',ids.savanna,true));
  if(duplicateTarumi) activeMedaka.set('duplicate',mkThread('Breeder profile - Masaharu Tarumi','duplicate',true));
  const activeShrimp = new Map();
  const catMedaka={id:'category-medaka',type:ChannelType.GuildCategory,name:wrongCategory?'🔬・AQUAPEDIA RESEARCH':'📚・AQUAPEDIA — SPECIES & GENETICS'};
  const catShrimp={id:'category-shrimp',type:ChannelType.GuildCategory,name:'📚・AQUAPEDIA'};
  const permission=(role)=>{
    if(role?.id==='everyone')return {has(flag){return !hidden && (flag===PermissionFlagsBits.ViewChannel||flag===PermissionFlagsBits.ReadMessageHistory)}};
    if(role?.id==='our-bot')return {has(flag){return !noBotWrite && [
      PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.SendMessagesInThreads
    ].includes(flag)}};
    return {has(){return false}};
  };
  const mkForum=(name,parentId,threads)=>{
    const forum={id:name, name, type:ChannelType.GuildForum, parentId, permissionsFor:permission, threads:{
      async fetchActive(){return {threads}},
      async fetchArchived(){if(failArchive)throw Error('pagination unavailable');return {threads:new Map(),hasMore:false}},
      async create({name:newName,message}) {
        const t=mkThread(newName,'thread-'+(++sequence),false);
        creates.push({forum:name,name:newName,payload:message});
        const result={id:'message-'+(++sequence),author:{id:'our-bot'},content:message.content,embeds:message.embeds};
        t.messages.fetch = async (q) => typeof q === 'string' ? result : new Map([[result.id,result]]);
        t.fetchStarterMessage=async()=>result;
        threads.set(t.id,t);
        return t;
      }
    }};return forum;
  };
  const medakaForum=mkForum('🐟・medaka-research',catMedaka.id,activeMedaka);
  const shrimpForum=mkForum('🦐・shrimp-research',catShrimp.id,activeShrimp);
  const guild={
    client:{user:{id:'our-bot'}},roles:{everyone:{id:'everyone'}},
    channels:{cache:new Map([[catMedaka.id,catMedaka],[catShrimp.id,catShrimp],[medakaForum.id,medakaForum],[shrimpForum.id,shrimpForum]]),
      async fetchActiveThreads(){return {threads:{size:0}}}}
  };
  return {guild,sends,creates,medakaForum,shrimpForum};
}
const request=(cards=originalCards)=>({
  status:'completed',ownerApproved:true,discordPublicationApproved:true,publicAudienceApproved:true,
  cards,routes:VERIFIED_BREEDER_ROUTES
});

test('actual queue is not publishable until owner + audience authorization',async()=>{
  const f=fixture();
  const result=await publishVerifiedBreederPublicBatch(f.guild,{...request(),discordPublicationApproved:queue.discordPublicationApproved});
  assert.equal(result.posted,0);assert.equal(f.sends.length+f.creates.length,0);
  assert.equal(result.reason,'owner_and_publication_approval_required');
});
test('four verified cards target two existing medaka and two new shrimp threads with exact receipts',async()=>{
  const f=fixture();const result=await publishVerifiedBreederPublicBatch(f.guild,request());
  assert.equal(result.posted,4,JSON.stringify(result));
  assert.equal(result.receipts.length,4);
  assert.equal(f.sends.length,2);
  assert.equal(f.creates.length,2);
  assert.ok(f.sends.some(x=>x.threadName.includes('Masaharu Tarumi')));
  assert.ok(f.sends.some(x=>x.threadName.includes('Medaka-ya Savanna')));
  assert.ok(f.creates.every(x=>x.forum==='🦐・shrimp-research'));
  assert.ok([...f.sends,...f.creates].every(x=>x.payload.allowedMentions.parse.length===0));
  assert.ok([...f.sends,...f.creates].every(x=>!x.payload.embeds?.some(e=>e.image||e.thumbnail)));
});
test('repeat dispatch never duplicates any of four records',async()=>{
  const f=fixture();const first=await publishVerifiedBreederPublicBatch(f.guild,request());
  assert.equal(first.posted,4);
  const again=await publishVerifiedBreederPublicBatch(f.guild,request());
  assert.equal(again.posted,0);assert.equal(again.skipped,4);
  assert.equal(f.sends.length,2);assert.equal(f.creates.length,2);
});
test('no alternative medaka thread is created if exact breeder thread cannot be found',async()=>{
  const f=fixture({omitTarumi:true});const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(res.posted,0);assert.equal(res.reason,'required_existing_breeder_thread_missing');
  assert.equal(f.creates.length,0);
});
test('duplicate breeder threads stop without guessing which one is authoritative',async()=>{
  const f=fixture({duplicateTarumi:true});const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(res.posted,0);assert.equal(res.reason,'ambiguous_existing_breeder_threads');
});
test('private/incorrect category fails closed',async()=>{
  const f=fixture({wrongCategory:true});const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(res.posted,0);assert.equal(res.reason,'target_forum_not_verified_public_and_writable');
});
test('public forum must allow everyone read and bot thread-writing',async()=>{
  for(const config of [{hidden:true},{noBotWrite:true}]){
    const f=fixture(config);const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[0]]));
    assert.equal(res.posted,0);assert.equal(f.sends.length+f.creates.length,0);
  }
});
test('incomplete thread enumeration blocks all writes',async()=>{
  const f=fixture({failArchive:true});const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[0]]));
  assert.equal(res.posted,0);assert.equal(res.reason,'thread_enumeration_incomplete');
});
test('failed message readback does not make a verified posting receipt',async()=>{
  const f=fixture({failReadback:true});const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(res.posted,0);assert.equal(res.receipts.length,0);
  assert.equal(res.reason,'write_unverified_stop_no_retry');
  assert.equal(f.sends.length,1);
});
test('social research card requires no photos, valid official sources and exact route',async()=>{
  const bads=[
    {...originalCards[0],photos:[{url:'https://example.org/image',reuseStatus:'unknown'}]},
    {...originalCards[0],sources:['https://reddit.com/r/medaka/comments/x']},
    {...originalCards[0],sources:['http://savanna-medaka.com/']},
    {...originalCards[0],id:'unverified-other-card'},
  ];
  for(const c of bads){
    const f=fixture();const res=await publishVerifiedBreederPublicBatch(f.guild,request([c]));
    assert.equal(res.posted,0);
    assert.equal(f.sends.length+f.creates.length,0);
    assert.equal(res.reason,'route_source_or_rights_invalid');
  }
});
test('medaka route cannot point into shrimp forum',async()=>{
  const f=fixture();const routes={...VERIFIED_BREEDER_ROUTES,[originalCards[1].id]:{...VERIFIED_BREEDER_ROUTES[originalCards[1].id],forum:'shrimp-research'}};
  const res=await publishVerifiedBreederPublicBatch(f.guild,{...request([originalCards[1]]),routes});
  assert.equal(res.posted,0);assert.equal(res.reason,'route_source_or_rights_invalid');
});
