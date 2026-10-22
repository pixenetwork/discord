import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { RESEARCH_GUILD_ID, RESEARCH_CATEGORY, RESEARCH_FORUMS } from '../src/canonical-research-forums.mjs';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';

function guildFixture(visible=true,activeCount=0){
 const created=[];
 const everyone={id:'everyone'};
 const category={id:RESEARCH_CATEGORY.id,type:4,name:RESEARCH_CATEGORY.name,permissionsFor(){return {has(){return visible;}};}};
 const duplicate={id:'1562207092239110264',name:'🐉・arowana-research',type:15,parentId:'1557338241903099945'};
 const forum={id:RESEARCH_FORUMS.arowana.id,type:15,name:'🐉・arowana-research',parentId:category.id,
   permissionsFor(role){return {has(flag){return role===everyone && visible;}};},
   threads:{
     async fetchActive(){return {threads:new Map()};},
     async fetchArchived(){return {threads:new Map(),hasMore:false};},
     async create({name,message}){
       created.push({name,message});
       const id=String(created.length);
       return {id:'thread-'+id, async fetchStarterMessage(){
         return {id:'message-'+id,author:{id:'bot'},embeds:message.embeds};
       }};
     }
   }};
 const guild={id:RESEARCH_GUILD_ID,roles:{everyone},client:{user:{id:'bot'}},
   channels:{cache:new Map([['category',category],['forum',forum],['duplicate',duplicate]]), async fetchActiveThreads(){return {threads:{size:activeCount}};} }};
 return {guild,created};
}
const card={id:'arowana.asian-arowana',name:'Asian arowana',entityType:'species',
 organismGroup:'arowana',summary:'Verified taxon with color morphs',
 description:'Scleropages formosus',history:'Southeast Asian drainage populations',
 lineage:'Color morphs are not separate species',care:'Large, secure aquaria',
 sources:['https://doi.org/10.1016/j.repbre.2023.12.001'],
 photos:[],websiteUrl:'https://aquapedia.app/arowanapedia/asian-arowana/'};
const approved={status:'completed',discordPublicationApproved:true,
 publicAudienceApproved:true,publicArowanaResearch:true,cards:[card]};
test('arowana publishes a single sourced canary in its own public forum and returns readback receipt',async()=>{
 const {guild,created}=guildFixture();
 const result=await publishAquapediaCards(guild,approved);
 assert.equal(result.posted,1);
 assert.equal(result.receipts.length,1);
 assert.equal(result.receipts[0].verified,true);
 assert.match(created[0].name,/^Species/);
 assert.match(created[0].message.content,/https:\/\/aquapedia\.app\/arowanapedia\/asian-arowana/);
});
test('arowana never posts to hidden forums or without explicit approvals',async()=>{
 for(const [visible,request] of [[false,approved],[true,{...approved,publicAudienceApproved:false}]]) {
  const {guild,created}=guildFixture(visible);
  const result=await publishAquapediaCards(guild,request);
  assert.equal(result.posted,0);
  assert.equal(created.length,0);
 }
});
test('arowana blocks mixed organism records and external article links',async()=>{
 for(const patch of [{organismGroup:'shrimp'},{websiteUrl:'https://example.com/'}]) {
  const {guild,created}=guildFixture();
  const result=await publishAquapediaCards(guild,{...approved,cards:[{...card,...patch}]});
  assert.equal(result.posted,0);assert.equal(created.length,0);
 }
});

test('global active-thread ceiling stops arowana forum creation without touching existing messages',async()=>{
 const {guild,created}=guildFixture(true,950);
 const result=await publishAquapediaCards(guild,approved);
 assert.equal(result.posted,0);
 assert.equal(created.length,0);
 assert.equal(result.reason,'discord_thread_capacity_guard');
});

test('same-named empty copy cannot replace a missing established arowana forum', async () => {
  const { guild, created } = guildFixture();
  guild.channels.cache.delete('forum');
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'canonical_research_destination_canonical_forum_not_found');
  assert.equal(created.length, 0);
});
