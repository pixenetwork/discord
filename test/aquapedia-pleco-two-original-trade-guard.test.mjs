import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoOriginalTradeIndex} from '../src/aquapedia-pleco-two-original-trade.mjs';
import {assessPlecoOriginalTradeIndex} from '../src/aquapedia-pleco-two-original-trade-guard.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const botId='1535522109571203152',guildId='1519337502379475095';
for(const key of ['l239','l398']){
 const plan=buildPlecoOriginalTradeIndex(catalog,key);
 const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560931428680601630',thread_metadata:{archived:false,locked:false}};
 const parent={id:thread.parent_id,type:15,permission_overwrites:[]};
 const starter={id:thread.id,author:{id:botId},content:'existing original research'};
 const input={plan,botId,guildId,thread,parent,messages:[starter]};
 test('source-only '+key+' links once and safely adopts exact original bot post',()=>{
  assert.deepEqual(assessPlecoOriginalTradeIndex(input),{mode:'create',messageId:null});
  const prior={id:'1564000000000000000',author:{id:botId},content:plan.content};
  assert.deepEqual(assessPlecoOriginalTradeIndex({...input,messages:[prior,starter]}),{mode:'adopt',messageId:prior.id});
 });
 test('source-only '+key+' fails closed on archived/renamed, private, incomplete history, or duplicate',()=>{
  for(const bad of [
   {...input,thread:{...thread,name:'wrong destination'}},
   {...input,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
   {...input,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
   {...input,parent:{...parent,permission_overwrites:[{id:guildId,deny:'1024'}]}},
   {...input,messages:[{...starter,author:{id:'somebodyelse'}}]},
   {...input,messages:[starter,{id:'x',author:{id:botId},content:plan.pageUrl}]},
   {...input,messages:[starter,{id:'x',author:{id:'other'},content:plan.content}]},
   {...input,messages:Array.from({length:100},(_,i)=>({...starter,id:String(i)}))}
  ])assert.throws(()=>assessPlecoOriginalTradeIndex(bad),/Pleco two original-trade guard/);
 });
}
