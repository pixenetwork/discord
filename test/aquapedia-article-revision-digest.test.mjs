import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('const channel=dest(url),old=state.receipts[key];');
const end=source.indexOf('state.pages[url]=item;',start);
assert.ok(start>=0&&end>start);
const snippet=source.slice(start,end).replace(/\bcontinue;/,'return {message:null,action:"migrated"};');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','item','entry','mode',
 'resolveArchivedReceiptChannel','migratePrivateShrimpArticle','saveAtomically',snippet+'return {message,action};');
const url='/medakapedia/strains/proven/',key='article-v1-digest-test',mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const channel='private-research';
const embed={title:'Article',description:'Unchanged catalog summary',url:'https://aquapedia.app'+url,
 color:123,footer:{text:'Aquapedia'},fields:[{name:'Evidence',value:'Link',inline:false}]};
const oldMessage={id:'original',channel_id:channel,author:{id:'bot'},content:'||'+mark+'||',
 embeds:[embed],attachments:[]};
test('changed article digest forces Discord PATCH even when title and summary are identical',async()=>{
 const state={pages:{[url]:{digest:'old'}},receipts:{[key]:{channel,messageId:'original',digest:'old'}}};
 const payload={content:oldMessage.content,embeds:[embed]};
 const calls={get:0,patch:0,post:0};
 const rest={
  get:async()=>{calls.get++;return oldMessage},
  patch:async()=>{calls.patch++;return oldMessage},
  post:async()=>{calls.post++;throw Error('POST must not replace an old message')},
 };
 const v=await run(rest,{channelMessage:(c,id)=>c+':'+id,channelMessages:()=> 'recent'},
  state,key,url,()=>channel,{id:'bot'},mark,payload,{digest:'new'},null,'apply',
  async()=>{throw Error('Unexpected archived lookup')},async()=>{throw Error('Not migration mode')},
  ()=>{});
 assert.equal(v.action,'updated');
 assert.equal(calls.patch,1);
 assert.equal(calls.post,0);
 assert.equal(calls.get,2);
});
test('generated research card includes the revision-specific digest fingerprint',()=>{
 assert.match(source,/Revision fingerprint/);
 assert.match(source,/item\.digest\.slice\(0,16\)/);
});
