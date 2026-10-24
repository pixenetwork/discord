import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessPlecoNamedSourceIndex} from '../src/aquapedia-pleco-two-named-source-guard.mjs';
import {buildPlecoNamedSourceIndex} from '../src/aquapedia-pleco-two-named-source.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const botId='1535522109571203152',guildId='1519337502379475095';
for(const key of ['anc-claro','pana-nocturnus']){
 const plan=buildPlecoNamedSourceIndex(catalog,key);
 const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560931428680601630',thread_metadata:{archived:false,locked:false}};
 const forum={id:thread.parent_id,type:15,permission_overwrites:[]};
 const starter={id:thread.id,author:{id:botId},content:'original research'};
 const original={plan,thread,parent:forum,botId,guildId,messages:[starter]};
 test('named source '+key+' can post once then adopt the exact same message',()=>{
  assert.deepEqual(assessPlecoNamedSourceIndex(original),{mode:'create',messageId:null});
  const post={id:'1563999999999999999',author:{id:botId},content:plan.content};
  assert.deepEqual(assessPlecoNamedSourceIndex({...original,messages:[post,starter]}),{mode:'adopt',messageId:post.id});
 });
 test('named source '+key+' fails closed for archived, hidden, renamed, duplicate, or foreign source',()=>{
  const invalid=[
   {...original,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
   {...original,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
   {...original,thread:{...thread,name:'unrecognized rename'}},
   {...original,parent:{...forum,permission_overwrites:[{id:guildId,deny:'1024'}]}},
   {...original,messages:[{...starter,author:{id:'somebody-else'}}]},
   {...original,messages:[starter,{id:'x',author:{id:botId},content:plan.pageUrl}]},
   {...original,messages:[starter,{id:'x',author:{id:'other'},content:plan.content}]},
   {...original,messages:Array.from({length:100},(_,i)=>({...starter,id:String(i)}))}
  ];
  invalid.forEach(x=>assert.throws(()=>assessPlecoNamedSourceIndex(x),/Pleco named-source guard/));
 });
}
