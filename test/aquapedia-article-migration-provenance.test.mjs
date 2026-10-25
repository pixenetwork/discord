import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the real publisher checkpoint assignment, not a synthetic
// standalone provenance function that could diverge from scheduled --apply.
const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('const channel=dest(url),old=state.receipts[key];');
const end=source.indexOf("if(action==='posted')posted++",start);
assert.ok(start>=0&&end>start,'find the real scheduled publisher write/receipt block');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const perform=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','entry','item','mode',
 'saveAtomically','resolveArchivedReceiptChannel','migratePrivateShrimpArticle',
 source.slice(start,end).replace(/\bcontinue;/,'return null;')+'return state.receipts[key];');
const url='/shrimpapedia/breeders/',key='article-v1-proof',mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const channel='private-shrimp';
const previousReceipt={channel:'old-public',messageId:'original-public-msg',verifiedAt:'2026-10-18T00:00:00Z'};
const originalReceipt={channel,messageId:'existing-private-msg',digest:'old',action:'migrated-to-private',
 previousReceipt};
const embed={title:'Article',description:'Updated',url:'https://aquapedia.app'+url,color:123,
 footer:{text:'AquaPedia'},fields:[{name:'Evidence',value:'Source citation',inline:false}]};
const payload={content:mark,embeds:[embed]};
const before={id:'existing-private-msg',channel_id:channel,author:{id:'bot'},
 content:'Prior '+mark,embeds:[{...embed,description:'Older summary'}],attachments:[]};
const after={...before,content:mark,embeds:[embed]};

test('future ordinary --apply PATCH retains the historical original public receipt',async()=>{
 const state={receipts:{[key]:structuredClone(originalReceipt)},pages:{[url]:{digest:'old'}},totalPosted:0};
 const events=[];
 const rest={
  get:async()=>{events.push('GET');return events.filter(x=>x==='GET').length===1?before:after},
  patch:async()=>{events.push('PATCH');return after},
  post:async()=>{throw Error('Do not POST for a migrated receipt')},
 };
 const record=await perform(rest,{channelMessage:(c,id)=>c+':'+id,channelMessages:()=> 'recent'},
  state,key,url,()=>channel,{id:'bot'},mark,payload,null,{digest:'updated'},'apply',
  ()=>events.push('SAVE'),async()=>{throw Error('Unexpected archived lookup')},
  async()=>{throw Error('Migration mode must remain separate')});
 assert.deepEqual(record.previousReceipt,previousReceipt);
 assert.equal(record.messageId,'existing-private-msg');
 assert.equal(record.channel,channel);
 assert.equal(record.digest,'updated');
 assert.equal(state.pages[url].digest,'updated');
 assert.deepEqual(events,['GET','PATCH','GET','SAVE']);
});
