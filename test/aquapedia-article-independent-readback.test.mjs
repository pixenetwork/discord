import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('const channel=dest(url),old=state.receipts[key];');
const end=source.indexOf('state.pages[url]=item;',start);
assert.ok(start>=0 && end>start,'Extract actual publisher Discord write and receipt-validation logic');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const runBlock=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','saveAtomically','mode','migratePrivateShrimpArticle',
 source.slice(start,end).replace(/\bcontinue;/,'return {message:null,action:"migrated"};')+'return {message,action};');

const url='/medakapedia/strains/rinkou/';
const key='article-v1-test-readback';
const channel='private-research';
const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const oldCard={id:'existing-123',channel_id:channel,author:{id:'trusted-bot'},content:'||'+mark+'||',
 embeds:[{title:'Prior version',description:'prior',url:'https://aquapedia.app'+url,fields:[]}],attachments:[]};
const payload={content:'||'+mark+'||',embeds:[{title:'Updated research article',description:'new source checked summary',
 url:'https://aquapedia.app'+url,fields:[{name:'Evidence',value:'No invented parentage',inline:false}]}]};
const updated={...oldCard,content:payload.content,embeds:payload.embeds};
function makeHarness({existing=true,first=oldCard,confirmed=updated,postResult=updated}={}){
 const calls={gets:[],posts:0,patches:0};
 const saved=existing?{messageId:oldCard.id,channel}:undefined;
 const state={receipts:saved?{[key]:saved}:{}};
 const before=JSON.stringify(state);
 const rest={
   get:async(route)=>{
     calls.gets.push(route);
     if(route==='recent')return [];
     if(calls.gets.filter(x=>x.startsWith('msg:')).length===1&&existing)return first;
     if(confirmed instanceof Error)throw confirmed;
     return confirmed;
   },
   patch:async()=>{calls.patches++;return updated;},
   post:async()=>{calls.posts++;return postResult}
 };
 return {calls,state,before,run:()=>runBlock(rest,{channelMessage:(c,id)=>'msg:'+id,channelMessages:()=> 'recent'},state,key,url,()=>channel,{id:'trusted-bot'},mark,payload,()=>{},'apply',async()=>{throw Error('Unexpected migration mode')})};
}
test('acknowledged PATCH is not accepted when fresh Discord GET still shows old embed',async()=>{
 const h=makeHarness({confirmed:oldCard});
 await assert.rejects(h.run(),/readback|mismatch/i);
 assert.deepEqual(h.calls.gets,['msg:existing-123','msg:existing-123']);
 assert.equal(h.calls.patches,1);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});
test('PATCH readback transport outage cannot advance receipt',async()=>{
 const h=makeHarness({confirmed:new Error('readback timeout')});
 await assert.rejects(h.run(),/readback timeout/);
 assert.deepEqual(h.calls.gets,['msg:existing-123','msg:existing-123']);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});
test('successful PATCH confirms same Discord ID, source card and bot before receipt',async()=>{
 const h=makeHarness();
 const result=await h.run();
 assert.equal(result.action,'updated');
 assert.equal(result.message.id,oldCard.id);
 assert.deepEqual(h.calls.gets,['msg:existing-123','msg:existing-123']);
 assert.equal(h.calls.posts,0);
});
test('new article POST must be independently fetched before a receipt can be saved',async()=>{
 const h=makeHarness({existing:false,confirmed:updated});
 const result=await h.run();
 assert.equal(result.action,'posted');
 assert.deepEqual(h.calls.gets,['recent','msg:existing-123']);
 assert.equal(h.calls.posts,1);
});

test('readback from a different Discord channel is rejected',async()=>{
 const h=makeHarness({confirmed:{...updated,channel_id:'wrong-channel'}});
 await assert.rejects(h.run(),/readback mismatch/);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});
test('readback with stale evidence field is rejected',async()=>{
 const stale={...updated,embeds:[{...payload.embeds[0],fields:[{name:'Evidence',value:'outdated evidence',inline:false}]}]};
 const h=makeHarness({confirmed:stale});
 await assert.rejects(h.run(),/readback mismatch/);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});
test('readback with wrong bot identity is rejected',async()=>{
 const h=makeHarness({confirmed:{...updated,author:{id:'untrusted-bot'}}});
 await assert.rejects(h.run(),/readback mismatch/);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});

test('independent readback refuses unexpected second embed',async()=>{
 const stale={...updated,embeds:[...updated.embeds,{title:'Unexpected media embed'}]};
 const h=makeHarness({confirmed:stale});
 await assert.rejects(h.run(),/readback mismatch/);
 assert.equal(h.calls.posts,0);
 assert.equal(JSON.stringify(h.state),h.before);
});
test('independent readback refuses hidden image or thumbnail data',async()=>{
 for(const extra of [{image:{url:'https://example.test/stale.jpg'}},
  {thumbnail:{url:'https://example.test/thumb.jpg'}},
  {author:{name:'External'}}]){
  const stale={...updated,embeds:[{...updated.embeds[0],...extra}]};
  const h=makeHarness({confirmed:stale});
  await assert.rejects(h.run(),/readback mismatch/);
  assert.equal(h.calls.posts,0);
 }
});

test('normal article readback refuses footer media icons despite matching text',async()=>{
 for(const media of [{icon_url:'https://example.test/old.png'},{proxy_icon_url:'https://example.test/proxy.png'}]){
  const h=makeHarness({confirmed:{...updated,embeds:[{...updated.embeds[0],
   footer:{text:payload.embeds[0].footer?.text,...media}}]}});
  await assert.rejects(h.run(),/readback mismatch/);
  assert.equal(h.calls.posts,0);
 }
});
