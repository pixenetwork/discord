import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const from=text.indexOf('const channel=dest(url),old=state.receipts[key];');
const to=text.indexOf('state.pages[url]=item;',from);
assert.ok(from>=0 && to>from,'find actual guarded Discord write block');
const snippet=text.slice(from,to);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const action=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','entry','resolveArchivedReceiptChannel','mode','migratePrivateShrimpArticle',snippet+' return {message,action};');
const url='/medakapedia/strains/rinkou/';
const key='article-v1-unchanged-key';
const mark='[AQUAPEDIA-ARTICLE-SYNC:'+key+']';
const channel='12345';
const existing={id:'legacy-123',channel_id:channel,author:{id:'bot-1'},content:'old content '+mark,embeds:[{title:'old',description:'old'}],attachments:[]};
const payload={content:'new content '+mark,embeds:[{title:'new',description:'new'}]};
function harness(get,extra={}){
 const calls={get:[],post:[],patch:[]};
 // Model persisted Discord state: subsequent GET must return the PATCHed card.
 let persisted=null;
 const rest={
  get:async(route,opts)=>{calls.get.push(route);return persisted||get(route,opts);},
  patch:async(route,opts)=>{
   calls.patch.push(route);
   persisted=extra.patchReturn||{...existing,...opts.body};
   return persisted;
  },
  post:async(route,opts)=>{
   calls.post.push(route);
   persisted={...existing,id:'new-post',...opts.body};
   return persisted;
  },
 };
 const state={receipts:{[key]:{messageId:existing.id,channel}}};
 return {calls,state,run:()=>action(rest,{channelMessage:(c,id)=>{extra.seenChannels?.push(c);return 'msg:'+id},channelMessages:c=>'recent'},state,key,url,()=>channel,{id:'bot-1'},mark,payload,null,(extra.resolve||(async()=>{throw Error('Old receipt missing message ID or channel mismatch')})),'apply',async()=>{throw Error('Unexpected migration mode')})};
}
for(const s of [403,404,429,500,503]){
 test('existing receipt '+s+' keeps writer and receipt unchanged',async()=>{
  const h=harness(async()=>{const e=new Error('status '+s);e.status=s;throw e;});
  const before=JSON.stringify(h.state);
  await assert.rejects(h.run(),{status:s});
  assert.deepEqual(h.calls.get,['msg:legacy-123']);
  assert.equal(h.calls.post.length,0);assert.equal(h.calls.patch.length,0);
  assert.equal(JSON.stringify(h.state),before);
 });
}
test('existing receipt GET timeout never POSTS or alters state',async()=>{
 const h=harness(async()=>{throw new Error('timeout')});
 await assert.rejects(h.run(),/timeout/);
 assert.equal(h.calls.post.length,0);assert.equal(h.calls.patch.length,0);
});
test('valid existing receipt PATCHes same message ID without POST',async()=>{
 const h=harness(async()=>existing);
 const r=await h.run();
 assert.equal(r.action,'updated');
 assert.equal(r.message.id,existing.id);
 assert.deepEqual(h.calls.patch,['msg:legacy-123']);
 assert.equal(h.calls.post.length,0);
});
test('valid unchanged card does not PATCH or POST',async()=>{
 const h=harness(async()=>({...existing,...payload}));
 const r=await h.run();
 assert.equal(r.action,'unchanged');
 assert.equal(h.calls.patch.length,0);assert.equal(h.calls.post.length,0);
});
test('marker mismatch stops without PATCH or POST',async()=>{
 const h=harness(async()=>({...existing,content:'unexpected'}));
 await assert.rejects(h.run(),/marker mismatch/);
 assert.equal(h.calls.patch.length,0);assert.equal(h.calls.post.length,0);
});
test('author mismatch stops without PATCH or POST',async()=>{
 const h=harness(async()=>({...existing,author:{id:'other-bot'}}));
 await assert.rejects(h.run(),/author or message marker mismatch/);
 assert.equal(h.calls.patch.length,0);assert.equal(h.calls.post.length,0);
});

test('recorded receipt with mismatched destination channel fails closed',async()=>{
 const h=harness(async()=>existing);
 h.state.receipts[key].channel='different-channel';
 const before=JSON.stringify(h.state);
 await assert.rejects(h.run(),/channel mismatch/);
 assert.deepEqual(h.calls,{get:[],post:[],patch:[]});
 assert.equal(JSON.stringify(h.state),before);
});
test('recorded receipt without message ID fails closed',async()=>{
 const h=harness(async()=>existing);
 delete h.state.receipts[key].messageId;
 const before=JSON.stringify(h.state);
 await assert.rejects(h.run(),/missing message ID/);
 assert.deepEqual(h.calls,{get:[],post:[],patch:[]});
 assert.equal(JSON.stringify(h.state),before);
});
test('recorded receipt GET null fails closed rather than searching recent posts',async()=>{
 const h=harness(async()=>null);
 const before=JSON.stringify(h.state);
 await assert.rejects(h.run(),/Old receipt missing/);
 assert.deepEqual(h.calls,{get:['msg:legacy-123'],post:[],patch:[]});
 assert.equal(JSON.stringify(h.state),before);
});

test('an archived breeder receipt is PATCHed in original verified channel, not fallback research-results',async()=>{
 const recorded='archived-original-thread';
 const seenChannels=[];
 const h=harness(async()=>({...existing,channel_id:recorded}),{
  seenChannels,
  patchReturn:{...existing,channel_id:recorded,...payload},
  resolve:async(receipt,proposed,entry)=>{
   assert.equal(receipt.channel,recorded);
   assert.equal(proposed,channel);
   return recorded;
  }
 });
 h.state.receipts[key].channel=recorded;
 const output=await h.run();
 assert.equal(output.action,'updated');
 assert.equal(output.message.id,existing.id);
 assert.equal(h.calls.post.length,0);
 assert.equal(h.calls.patch.length,1);
 assert.ok(seenChannels.length>=2);
 assert.ok(seenChannels.every(id=>id===recorded));
});
