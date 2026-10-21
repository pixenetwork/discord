import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';
import { createResearchService } from '../src/research.mjs';

const card = {
  id: 'GUP-001', name: 'Wild grey standard', entityType: 'strain',
  organismGroup: 'guppy', photos: [],
  summary: 'IKGH base color classification, not a pedigree-confirmed bloodline.',
  confidence: 'Official show trait; parentage unverified',
  lineage: 'Parent lines not documented',
  sources: ['https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf'],
  websiteUrl: 'https://aquapedia.app/guppypedia/entries/gup-001/',
};
const approval = {
  status:'completed', discordPublicationApproved:true,
  publicAudienceApproved:true, publicGuppyResearch:true, cards:[card],
};

function guildFixture({publicVisible=true, forumName='🐠・guppy-research'}={}) {
  const created=[];
  const everyone={id:'everyone'};
  const category={id:'aquapedia-public',type:4,name:'📚・AQUAPEDIA'};
  const forum={
    id:'guppy-forum',parentId:category.id,type:15,name:forumName,
    permissionsFor(role) {return {has(flag) {return role===everyone && publicVisible &&
      [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory].includes(flag);}};},
    threads:{
      async fetchActive(){return {threads:new Map()};},
      async fetchArchived(){return {threads:new Map(),hasMore:false};},
      async create({name,message}){
        created.push({name,message});
        return {id:'guppy-thread-'+created.length,async fetchStarterMessage(){
          return {id:'guppy-message-'+created.length,author:{id:'bot'},embeds:message.embeds};
        }};
      },
    },
  };
  const guild={roles:{everyone},client:{user:{id:'bot'}},
    channels:{cache:new Map([['category',category],['forum',forum]]),async fetchActiveThreads(){return {threads:{size:0}};}}};
  return {guild,created};
}

test('a reviewed guppy strain is routed only into the existing public guppy forum with a verified receipt',async()=>{
  const {guild,created}=guildFixture();
  const out=await publishAquapediaCards(guild,approval);
  assert.equal(out.posted,1,JSON.stringify(out));
  assert.equal(out.receipts.length,1);
  assert.equal(out.receipts[0].verified,true);
  assert.match(created[0].name,/GUP-001/);
  assert.match(created[0].message.content,/aquapedia\.app\/guppypedia\/entries\/gup-001\//);
  assert.deepEqual(created[0].message.allowedMentions,{parse:[]});
});

test('guppy publishing fails closed for missing approvals, private forum or mixed destination flags',async()=>{
  for(const patch of [
    {discordPublicationApproved:false},
    {publicAudienceApproved:false},
    {status:'queued'},
    {publicArowanaResearch:true},
    {publicShrimpResearch:true},
  ]){
    const {guild,created}=guildFixture();
    const result=await publishAquapediaCards(guild,{...approval,...patch});
    assert.equal(result.posted,0);
    assert.equal(created.length,0);
  }
  const {guild,created}=guildFixture({publicVisible:false});
  const result=await publishAquapediaCards(guild,approval);
  assert.equal(result.posted,0);
  assert.equal(created.length,0);
});

test('guppy publisher refuses external or unregistered pages, unsupported taxa and images',async()=>{
  for(const patch of [
    {organismGroup:'shrimp'},
    {id:'GUP-002'}, // A valid but different entry ID must not claim this article.
    {websiteUrl:'https://aquapedia.app/shrimpapedia/'},
    {websiteUrl:'https://example.net/guppypedia/entries/gup-001/'},
    {websiteUrl:'https://aquapedia.app/guppypedia/care/'},
    {photos:[{url:'https://example.net/a.jpg',reuseStatus:'owner_owned',credit:'owner'}]},
    {sources:['http://example.com/unsafe']},
  ]){
    const {guild,created}=guildFixture();
    const result=await publishAquapediaCards(guild,{...approval,cards:[{...card,...patch}]});
    assert.equal(result.posted,0,JSON.stringify(patch));
    assert.equal(created.length,0);
  }
});

test('Jarvis explicit review and public-destination fields survive the research service handoff',async()=>{
  const original=globalThis.fetch;
  const recorded=[];
  globalThis.fetch=async()=>({ok:true,async json(){return {
    status:'completed',summary:'Source-backed research complete',files:[],cards:[card],
    discordPublicationApproved:true,publicAudienceApproved:true,publicGuppyResearch:true,
  };}});
  try{
    const service=createResearchService({
      jarvis:{researchEndpoint:'https://example.com/research',apiKey:null},
      aquapedia:{githubToken:null,repository:'pixenetwork/aquapedia',branch:'main'},
      store:{async recordResearchJob(job){recorded.push(job);}},
    });
    const result=await service.research({entityType:'strain',name:'Wild grey standard',requestedBy:'1519337502379475095'});
    assert.equal(result.status,'completed');
    assert.equal(result.discordPublicationApproved,true);
    assert.equal(result.publicAudienceApproved,true);
    assert.equal(result.publicGuppyResearch,true);
    assert.equal(result.cards.length,1);
    assert.equal(recorded.at(-1).status,'completed');
  }finally{globalThis.fetch=original;}
});
