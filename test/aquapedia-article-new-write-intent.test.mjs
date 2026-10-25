import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('const channel=dest(url),old=state.receipts[key];');
const end=src.indexOf('state.pages[url]=item;',start);
assert.ok(start>=0&&end>start,'Find production article write flow');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const perform=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','item','saveAtomically','mode','migratePrivateShrimpArticle',src.slice(start,end).replace(/\bcontinue;/,'return {message:null,action:"migrated"};')+'return {message,action};');
const url='/medakapedia/strains/verified-new/';
const key='article-v1-new-article';
const channel='private-research';
const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const payload={content:'||'+mark+'||',embeds:[{title:'Source checked',url:'https://aquapedia.app'+url,
 description:'Link to original',fields:[{name:'Evidence',value:'Sourced',inline:false}],color:123456,footer:{text:'Aquapedia'}}]};
const message={id:'new-message',channel_id:channel,author:{id:'bot-user'},content:payload.content,embeds:payload.embeds,attachments:[]};
function harness({readbackFails=false}={}){
 const calls=[],state={receipts:{}};
 const saveAtomically=s=>{calls.push({kind:'save',receipt:structuredClone(s.receipts[key]||null)})};
 const rest={
  get:async route=>{
   calls.push({kind:'get',route});
   if(route==='recent')return [];
   if(readbackFails)throw Error('Discord GET unavailable');
   return message;
  },
  post:async()=>{calls.push({kind:'post'});return message},
  patch:async()=>{throw Error('PATCH forbidden on new item')}
 };
 const run=()=>perform(rest,{channelMessages:()=> 'recent',channelMessage:(ch,id)=> 'message:'+id},
  state,key,url,()=>channel,{id:'bot-user'},mark,payload,{digest:'new'},saveAtomically,'apply',async()=>{throw Error('Unexpected migration mode')});
 return {calls,state,run};
}
test('a new Discord POST requires a durable pending receipt BEFORE external write',async()=>{
 const h=harness();
 const x=await h.run();
 assert.equal(x.action,'posted');
 const before=h.calls.findIndex(c=>c.kind==='save');
 const post=h.calls.findIndex(c=>c.kind==='post');
 assert.ok(before>=0&&post>before,'save pending intent before POST');
 assert.equal(h.calls[before].receipt?.status,'pending');
 assert.equal(h.calls[before].receipt?.channel,channel);
 assert.equal(h.calls[before].receipt?.messageId??null,null);
});
test('failed post-readback leaves a pending receipt to prevent unsafe retries',async()=>{
 const h=harness({readbackFails:true});
 await assert.rejects(h.run(),/Discord GET unavailable/);
 assert.equal(h.state.receipts[key]?.status,'pending');
 assert.equal(h.state.receipts[key]?.messageId??null,null);
 assert.equal(h.calls.filter(c=>c.kind==='post').length,1);
});

test('retry after an uncertain first POST refuses to create a second message',async()=>{
 const h=harness({readbackFails:true});
 await assert.rejects(h.run(),/Discord GET unavailable/);
 await assert.rejects(h.run(),/Old receipt missing message ID or channel mismatch/);
 assert.equal(h.calls.filter(c=>c.kind==='post').length,1);
 assert.equal(h.state.receipts[key]?.status,'pending');
});
