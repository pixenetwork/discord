import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { prepareShrimpPublicBatch } from '../src/shrimp-public-batch.mjs';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

// Explicitly offline: all guild objects below are in-memory mocks.
// This harness never accepts or reads bot credentials or makes Discord API calls.
const [breederFile, contestFile] = process.argv.slice(2);
if (!breederFile || !contestFile) throw new Error('Usage: node tools/verify-shrimp-batch-e2e.mjs <breeders.json> <contests.json>');
const breeders=JSON.parse(readFileSync(breederFile,'utf8'));
const contests=JSON.parse(readFileSync(contestFile,'utf8'));
const noApproval=prepareShrimpPublicBatch({breederManifest:breeders,contestManifest:contests});
assert.equal(noApproval.cards.length,22);
assert.equal(noApproval.discordPublicationApproved,false);
const approved=prepareShrimpPublicBatch({breederManifest:breeders,contestManifest:contests,editorialApproved:true,publicAudienceApproved:true});
const storedThreads=new Map(), events=[];
const category={id:'aqua-cat',name:'📚・AQUAPEDIA',type:ChannelType.GuildCategory};
const forum={id:'shrimp-forum-id',name:'🦐・shrimp-research',type:ChannelType.GuildForum,parentId:category.id,
  permissionsFor(){return {has(flag){return [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory].includes(flag)}}},
  threads:{
    async fetchActive(){return {threads:storedThreads}},
    async fetchArchived(){return {threads:new Map(),hasMore:false}},
    async create({name,message}){
      const id='thread-'+(storedThreads.size+1);
      const m={id:'msg-'+(storedThreads.size+1),author:{id:'the-bot'},embeds:message.embeds,
        async edit(newPayload){this.embeds=newPayload.embeds;events.push({op:'edit',id});return this}};
      const thread={id,name,archived:false,
        messages:{async fetch(q){return typeof q==='string'?m:new Map([[m.id,m]])}},
        async fetchStarterMessage(){return m}};
      storedThreads.set(id,thread);events.push({op:'create',id,name});
      return thread;
    }
  }
};
const guild={roles:{everyone:{id:'everyone'}},client:{user:{id:'the-bot'}},channels:{
 cache:new Map([['cat',category],['forum',forum]]),
 async fetchActiveThreads(){return {threads:storedThreads}}
}};
const rejected=await publishAquapediaCards(guild,noApproval);
assert.equal(rejected.posted,0);assert.equal(storedThreads.size,0);
const canary=await publishAquapediaCards(guild,{...approved,cards:approved.cards.slice(0,1)});
assert.equal(canary.posted,1);
assert.equal(canary.receipts.length,1);
assert.equal(storedThreads.size,1);
const rest=await publishAquapediaCards(guild,{...approved,cards:approved.cards.slice(1)});
assert.equal(rest.posted,21);
assert.equal(rest.receipts.length,21);
assert.equal(storedThreads.size,22);
const receipts=[...canary.receipts,...rest.receipts];
assert.equal(new Set(receipts.map(x=>x.recordId)).size,22);
assert.equal(new Set(receipts.map(x=>x.messageId)).size,22);
assert.equal(new Set(receipts.map(x=>x.threadId)).size,22);
const rerun=await publishAquapediaCards(guild,approved);
assert.equal(rerun.posted,22);
assert.equal(rerun.receipts.length,22);
assert.equal(storedThreads.size,22);
assert.equal(events.filter(e=>e.op==='create').length,22);
assert.equal(events.filter(e=>e.op==='edit').length,22);
console.log(JSON.stringify({simulation:true,sourceBreeders:breeders.cards.length,sourceContests:contests.records.filter(x=>x.kind==='competition').length,approvalDefault:'CLOSED',canaryVerified:canary.receipts.length,remainingVerified:rest.receipts.length,uniqueReceipts:receipts.length,secondPassUpdated:rerun.posted,threadsCreated:storedThreads.size,duplicatesCreated:0,realDiscordWrites:0}));
