import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 migratePrivateShrimpArticle,LEGACY_SHRIMP_GUIDES_CHANNEL,
 PRIVATE_SHRIMP_UPDATES_CHANNEL,PRIVATE_SHRIMP_MIGRATION_ROUTES
} from '../tools/aquapedia-private-shrimp-migration.mjs';

const botId='bot-123',url=PRIVATE_SHRIMP_MIGRATION_ROUTES[0],key='article-v1-historical';
const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const payload={content:'Verified private article summary '+mark,
 embeds:[{title:'Private article update',url:'https://aquapedia.app'+url,
  description:'Sourced article content',color:12345,
  footer:{text:'AquaPedia'},fields:[{name:'Evidence',value:'Source linked',inline:false}]}]};
const oldMessage={id:'old-public-message',channel_id:LEGACY_SHRIMP_GUIDES_CHANNEL,
 author:{id:botId},content:'Old public article '+mark,
 embeds:[{url:'https://aquapedia.app'+url}],attachments:[]};
const newMessage={id:'new-private-message',channel_id:PRIVATE_SHRIMP_UPDATES_CHANNEL,
 author:{id:botId},content:payload.content,embeds:payload.embeds,attachments:[]};
function harness(extra={}){
 const old={messageId:oldMessage.id,channel:LEGACY_SHRIMP_GUIDES_CHANNEL,digest:'prior'};
 const state={pages:{[url]:{digest:'prior'}},receipts:{[key]:old},totalPosted:1,lastScan:'before'};
 const events=[],snapshots=[];
 const saveAtomically=(value)=>{
  events.push('save');
  snapshots.push(structuredClone(value));
  if(extra.failFirstSave&&snapshots.length===1)throw Error('disk write failure');
  if(extra.failFinalSave&&snapshots.length===2)throw Error('final save failure');
 };
 const rest={
  get:async route=>{
   events.push('get:'+route);
   if(route==='old:old-public-message')return extra.badOld??oldMessage;
   if(route==='recent')return extra.recent??[];
   if(route==='new:new-private-message'){
    if(extra.readbackError)throw Error('readback timeout');
    return extra.newReadback??newMessage;
   }
   throw Error('Unexpected GET '+route);
  },
  post:async()=>{events.push('post');if(extra.postError)throw Error('POST timeout');return newMessage},
 };
 const run=(updates={})=>migratePrivateShrimpArticle({
  url,key,mark,old:state.receipts[key],targetChannel:PRIVATE_SHRIMP_UPDATES_CHANNEL,
  rest,Routes:{channelMessage:(channel,id)=>(channel===LEGACY_SHRIMP_GUIDES_CHANNEL?'old:':'new:')+id,channelMessages:()=> 'recent'},
  botId,payload,item:{digest:'updated'},state,saveAtomically,now:()=> '2026-10-24T00:00:00Z',...updates,
 });
 return {state,events,snapshots,run};
}
test('valid historical public receipt becomes one verified private message with provenance',async()=>{
 const h=harness();
 const receipt=await h.run();
 assert.equal(receipt.action,'migrated-to-private');
 assert.equal(h.events.filter(x=>x==='post').length,1);
 assert.ok(h.events.indexOf('save')<h.events.indexOf('post'));
 assert.equal(h.snapshots[0].receipts[key].status,'pending-migration');
 assert.equal(h.snapshots[0].receipts[key].messageId,null);
 assert.equal(h.state.receipts[key].messageId,newMessage.id);
 assert.equal(h.state.receipts[key].previousReceipt.messageId,oldMessage.id);
 assert.equal(h.state.receipts[key].previousReceipt.channel,LEGACY_SHRIMP_GUIDES_CHANNEL);
 assert.equal(h.state.pages[url].digest,'updated');
 assert.equal(h.state.totalPosted,2);
});
test('failed durable pending save prohibits any Discord POST',async()=>{
 const h=harness({failFirstSave:true});
 await assert.rejects(h.run(),/disk write failure/);
 assert.equal(h.events.filter(x=>x==='post').length,0);
});
test('uncertain POST leaves durable pending record; retry refuses second POST',async()=>{
 const h=harness({postError:true});
 await assert.rejects(h.run(),/POST timeout/);
 assert.equal(h.state.receipts[key].status,'pending-migration');
 await assert.rejects(h.run(),/unapproved URL, channel or historical receipt/);
 assert.equal(h.events.filter(x=>x==='post').length,1);
});
test('readback outage leaves pending receipt; retry does not repost',async()=>{
 const h=harness({readbackError:true});
 await assert.rejects(h.run(),/readback timeout/);
 assert.equal(h.state.receipts[key].status,'pending-migration');
 await assert.rejects(h.run(),/unapproved URL, channel or historical receipt/);
 assert.equal(h.events.filter(x=>x==='post').length,1);
});
test('stale or mismatched bot author in public original prevents POST',async()=>{
 const h=harness({badOld:{...oldMessage,author:{id:'other-bot'}}});
 await assert.rejects(h.run(),/historical Discord receipt failed readback/);
 assert.equal(h.events.filter(x=>x==='post').length,0);
});
test('already-present target marker must be reviewed rather than POSTed again',async()=>{
 const h=harness({recent:[newMessage]});
 await assert.rejects(h.run(),/existing private post requires manual reconciliation/);
 assert.equal(h.events.filter(x=>x==='post').length,0);
});
test('mismatched new-channel readback never commits completed receipt',async()=>{
 const h=harness({newReadback:{...newMessage,channel_id:'wrong'}});
 await assert.rejects(h.run(),/independent private readback mismatch/);
 assert.equal(h.state.receipts[key].status,'pending-migration');
 assert.equal(h.state.pages[url].digest,'prior');
});
test('failed final checkpoint persists pending receipt and prohibits retry',async()=>{
 const h=harness({failFinalSave:true});
 await assert.rejects(h.run(),/final save failure/);
 assert.equal(h.state.receipts[key].messageId,newMessage.id);
 // Durable snapshot 0 still has only the pending reservation on disk.
 assert.equal(h.snapshots[0].receipts[key].status,'pending-migration');
});
test('migration guard excludes arbitrary shrimp and other fish routes',async()=>{
 const h=harness();
 await assert.rejects(h.run({url:'/shrimpapedia/breeders/random/'}),/unapproved URL/);
 await assert.rejects(h.run({targetChannel:'public-guides'}),/unapproved URL/);
 await assert.rejects(h.run({url:'/medakapedia/strains/rinkou/'}),/unapproved URL/);
 assert.equal(h.events.filter(x=>x==='post').length,0);
});

const fsReadPublisher=()=>fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');

test('actual publisher migration mode is opt-in, fenced, and cannot run as ordinary apply',()=>{
 const source=fsReadPublisher();
 assert.match(source,/process\.argv\.includes\('--migrate-shrimp-private'\)/);
 assert.match(source,/process\.argv\.includes\('--apply'\)/);
 assert.match(source,/AQUAPEDIA_PRIVATE_SHRIMP_MIGRATION_APPROVAL/);
 assert.match(source,/JARVIS_GOVERNED_DISCORD64_PRIVATE_SHRIMP_20261024/);
 assert.match(source,/mode==='migrate'\?changes\.filter\(url=>PRIVATE_SHRIMP_MIGRATION_ROUTES\.includes\(url\)\)/);
 assert.match(source,/const receipt=await migratePrivateShrimpArticle\(/);
 assert.match(source,/mode==='apply'\|\|mode==='migrate'/);
});
