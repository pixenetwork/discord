import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('const channel=dest(url),old=state.receipts[key];');
const end=source.indexOf("console.log('ARTICLE_VERIFIED",start);
assert.ok(start>=0 && end>start,'Actual full message/checkpoint block must be found');
const statement=source.slice(start,end);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const runner=new AsyncFunction('rest','Routes','state','key','url','dest','me','mark','payload','item','saveAtomically','cap','fs','lockFile',statement+'return true;');
for(const status of [403,404,429,500,503,'timeout']){
 test('failed '+status+' must not post, patch or save checkpoint',async()=>{
  const calls={get:0,post:0,patch:0,save:0};
  const url='/medakapedia/strains/rinkou/';
  const key='article-v1-original';
  const old={key,url,messageId:'existing-id',channel:'private-channel',digest:'old'};
  const state={pages:{[url]:{digest:'old'}},receipts:{[key]:{...old}},lastScan:'original',totalPosted:50};
  const before=JSON.stringify(state);
  const rest={
    get:async()=>{calls.get++;const e=new Error('simulated '+status);e.status=status;throw e;},
    post:async()=>{calls.post++;throw new Error('POST should not occur')},
    patch:async()=>{calls.patch++;throw new Error('PATCH should not occur')}
  };
  await assert.rejects(runner(rest,{channelMessage:()=>'/x',channelMessages:()=>'/recent'},state,key,url,()=>old.channel,{id:'bot'},'marker',{content:'next',embeds:[]},{digest:'next'},()=>{calls.save++},50,fs,'mock-lock'),/simulated/);
  assert.deepEqual(calls,{get:1,post:0,patch:0,save:0});
  assert.equal(JSON.stringify(state),before);
 });
}