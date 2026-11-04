import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { publishVerifiedBreederPublicBatch, VERIFIED_BREEDER_ROUTES } from '../src/verified-breeder-public-batch.mjs';

const queue = JSON.parse(readFileSync(new URL('./fixtures-verified-breeders.json', import.meta.url), 'utf8'));
const originalCards = queue.cards;
function fixture({
  omitTarumi = false, duplicateTarumi = false, hidden = false,
  noBotWrite = false, noCreatePermission = false, noSendMessages = false, wrongCategory = false, failArchive = false,
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
    if(role?.id==='our-bot')return {has(flag){return !noBotWrite
      && !(noCreatePermission && flag===PermissionFlagsBits.CreatePublicThreads)
      && !(noSendMessages && flag===PermissionFlagsBits.SendMessages) && [
      PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.SendMessagesInThreads,PermissionFlagsBits.CreatePublicThreads,PermissionFlagsBits.SendMessages
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
    {...originalCards[0],sources:['https://reddit.com./r/medaka/comments/x']},
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

test('wrongly reassigned breeder ID route is rejected even within the same public forum',async()=>{
  const f=fixture();
  const routes={...VERIFIED_BREEDER_ROUTES,
    [originalCards[1].id]:{...VERIFIED_BREEDER_ROUTES[originalCards[1].id],breederKey:'Medaka-ya Savanna'}};
  const res=await publishVerifiedBreederPublicBatch(f.guild,{...request([originalCards[1]]),routes});
  assert.equal(res.posted,0);
  assert.equal(res.reason,'route_source_or_rights_invalid');
  assert.equal(f.sends.length+f.creates.length,0);
});
test('a different breeder thread merely mentioning Tarumi must not be selected',async()=>{
  const f=fixture();
  const map=(await f.medakaForum.threads.fetchActive()).threads;
  map.delete('medaka-tarumi');
  map.set('wrong-subject',{id:'wrong-subject',name:'BREEDER - Yukio Oba discussion about Masaharu Tarumi'});
  const result=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(result.posted,0);
  assert.equal(result.reason,'required_existing_breeder_thread_missing');
  assert.equal(f.sends.length+f.creates.length,0);
});

test('potential existing Larmax research topic blocks a duplicate breeder thread',async()=>{
  const f=fixture();
  const shrimp=(await f.shrimpForum.threads.fetchActive()).threads;
  shrimp.set('prior-larmax',{id:'prior-larmax',name:'Research — Larmax International stock history'});
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[2]]));
  assert.equal(res.posted,0);
  assert.equal(res.reason,'potential_duplicate_breeder_subject_needs_review');
  assert.equal(f.creates.length,0);
});
test('forum creation uses SendMessages and does not require CreatePublicThreads',async()=>{
  const f=fixture({noCreatePermission:true});
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[2]]));
  assert.equal(res.posted,1);
  assert.equal(res.reason,'verified_readback_receipts');
  assert.equal(f.creates.length,1);
});

test('missing SendMessages stops forum creation before the API write',async()=>{
  const f=fixture({noSendMessages:true});
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[2]]));
  assert.equal(res.posted,0);
  assert.equal(res.reason,'bot_missing_forum_post_creation_permission');
  assert.equal(f.creates.length,0);
});

for(const [name,invalid] of [
  ['missing name',{...originalCards[1],name:''}],
  ['oversized source',{...originalCards[1],sources:['https://example.org/'+ 'x'.repeat(430)]}],
]){
  test('a later '+name+' blocks the batch before any earlier card is posted',async()=>{
    const f=fixture();
    const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[0],invalid]))
      .catch(error=>({error}));
    assert.equal(f.sends.length+f.creates.length,0,'Payload preflight must finish before any write');
    assert.equal(res.reason,'card_payload_invalid');
    assert.equal(res.posted,0);
    assert.deepEqual(res.receipts,[]);
  });
}

test('sources the builder would discard fail the entire batch before writes',async()=>{
  for(const source of [
    'https://127.0.0.1/evidence','https://[::1]/evidence',
    'https://localhost/evidence','https://fish.localhost/evidence',
    'https://fish.local/evidence','https://fish.internal/evidence',
  ]){
    const f=fixture();
    const invalid={...originalCards[1],sources:[source]};
    const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[0],invalid]));
    assert.equal(res.reason,'card_source_not_preserved_in_payload',source);
    assert.equal(res.posted,0);
    assert.equal(f.sends.length+f.creates.length,0);
  }
});

test('a discarded source cannot be disguised inside another citation URL',async()=>{
  const f=fixture();
  const card={...originalCards[1],sources:[
    'https://example.org/?citation=](https://localhost/evidence',
    'https://localhost/evidence',
  ]};
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([card]));
  assert.equal(res.reason,'card_source_not_preserved_in_payload');
  assert.equal(res.posted,0);
  assert.equal(f.sends.length+f.creates.length,0);
});

test('complete source citations remain valid when the builder splits their fields',async()=>{
  const f=fixture();
  const card={...originalCards[1],sources:[1,2,3].map(n=>'https://example.org/'+n+'/'+ 'x'.repeat(220))};
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([card]));
  assert.equal(res.posted,1);
  const fields=f.sends[0].payload.embeds[0].fields.filter(x=>x.name.startsWith('Research sources'));
  assert.equal(fields.length,3);
  for(const url of card.sources)assert.ok(fields.some(x=>x.value.includes(url)));
});

async function addTarumiHistory(f,messages){
  const thread=(await f.medakaForum.threads.fetchActive()).threads.get('medaka-tarumi');
  const fetch=thread.messages.fetch;
  thread.messages.fetch=async arg=>{
    const result=await fetch(arg);
    return typeof arg==='string'?result:new Map([...result,...messages.map(m=>[m.id,m])]);
  };
}

test('a member copying the marker and footer cannot count as a verified existing post',async()=>{
  const f=fixture();const card=originalCards[1];
  await addTarumiHistory(f,[{
    id:'member-copy',author:{id:'human'},content:'[AQ-BREEDER:'+card.id+']',
    embeds:[{footer:{text:'Aquapedia • '+card.id+' • photos pending rights review'}}],
  }]);
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([card]));
  assert.equal(res.reason,'existing_breeder_message_unverified_needs_review');
  assert.equal(res.posted,0);
  assert.equal(res.skipped,0);
  assert.equal(res.receipts.length,0);
  assert.equal(f.sends.length+f.creates.length,0);
});

test('an incomplete bot-owned marker requires review without retrying the write',async()=>{
  const f=fixture();const card=originalCards[1];
  await addTarumiHistory(f,[{
    id:'unverified-bot-write',author:{id:'our-bot'},content:'[AQ-BREEDER:'+card.id+']',embeds:[],
  }]);
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([card]));
  assert.equal(res.reason,'existing_breeder_message_unverified_needs_review');
  assert.equal(res.posted,0);
  assert.equal(res.skipped,0);
  assert.equal(f.sends.length+f.creates.length,0);
});

test('duplicate bot-owned markers require review instead of claiming one existing post',async()=>{
  const f=fixture();const card=originalCards[1];
  await addTarumiHistory(f,['first','second'].map(id=>({
    id,author:{id:'our-bot'},content:'[AQ-BREEDER:'+card.id+']',
    embeds:[{footer:{text:'Aquapedia • '+card.id+' • photos pending rights review'}}],
  })));
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([card]));
  assert.equal(res.reason,'existing_breeder_message_unverified_needs_review');
  assert.equal(res.posted,0);
  assert.equal(res.skipped,0);
  assert.equal(f.sends.length+f.creates.length,0);
});

test('public archived-thread pagination uses the oldest archive Date cursor',async()=>{
  const f=fixture();
  const active=(await f.medakaForum.threads.fetchActive()).threads;
  const tarumi=active.get('medaka-tarumi');active.delete('medaka-tarumi');tarumi.archived=true;
  const oldest=new Date('2026-10-20T00:00:00.000Z');
  const calls=[];
  f.medakaForum.threads.fetchArchived=async options=>{
    calls.push(options);
    return calls.length===1
      ?{threads:new Map([['unrelated',{id:'unrelated',name:'Unrelated archive',archivedAt:oldest}]]),hasMore:true}
      :{threads:new Map([[tarumi.id,tarumi]]),hasMore:false};
  };
  const res=await publishVerifiedBreederPublicBatch(f.guild,request([originalCards[1]]));
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0],{limit:100});
  assert.equal(calls[1].before,oldest);
  assert.equal(calls[1].limit,100);
  assert.equal(res.reason,'existing_thread_archived_needs_review');
  assert.equal(f.sends.length+f.creates.length,0);
});
