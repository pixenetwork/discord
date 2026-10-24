import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoKokoIndex} from '../src/aquapedia-pleco-koko-source.mjs';
import {assessPlecoKokoIndex} from '../src/aquapedia-pleco-koko-guard.mjs';
const records=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const plan=buildPlecoKokoIndex(records);
const botId='1535522109571203152',guildId='1519337502379475095';
const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560931428680601630',thread_metadata:{archived:false,locked:false}};
const parent={id:thread.parent_id,type:15,permission_overwrites:[]};
const starter={id:thread.id,author:{id:botId},content:'Original species taxon source'};
const init={plan,botId,guildId,thread,parent,messages:[starter]};
test('only original bot authored named public thread may post; repeats adopt unchanged exact message',()=>{
 assert.deepEqual(assessPlecoKokoIndex(init),{mode:'create',messageId:null});
 const existing={id:'1564000000000000000',author:{id:botId},content:plan.content};
 assert.deepEqual(assessPlecoKokoIndex({...init,messages:[existing,starter]}),{mode:'adopt',messageId:existing.id});
});
test('fail closed when archived, private, renamed, foreign author, existing backlink or truncated history',()=>{
 for(const bad of [
  {...init,thread:{...thread,name:'renamed or reused thread'}},
  {...init,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
  {...init,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
  {...init,parent:{...parent,permission_overwrites:[{id:guildId,deny:'1024'}]}},
  {...init,messages:[{...starter,author:{id:'foreign'}}]},
  {...init,messages:[starter,{id:'123',author:{id:botId},content:plan.pageUrl}]},
  {...init,messages:[starter,{id:'124',author:{id:'foreign'},content:plan.content}]},
  {...init,messages:Array.from({length:100},(_,i)=>({...starter,id:String(i)}))}
 ])assert.throws(()=>assessPlecoKokoIndex(bad),/Pleco koko thread check/);
});
