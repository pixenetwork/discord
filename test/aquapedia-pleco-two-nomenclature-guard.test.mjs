import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessPlecoNomenclatureIndex} from '../src/aquapedia-pleco-two-nomenclature-guard.mjs';
import {buildPlecoNomenclatureIndex} from '../src/aquapedia-pleco-two-nomenclature.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const botId='1535522109571203152',guildId='1519337502379475095';
for(const key of ['hyp-vandragti','pana-changae']){
 const plan=buildPlecoNomenclatureIndex(catalog,key);
 const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560931428680601630',thread_metadata:{archived:false,locked:false}};
 const parent={id:'1560931428680601630',type:15,permission_overwrites:[]};
 const starter={id:plan.threadId,author:{id:botId},content:'original taxonomy references'};
 const args={plan,thread,parent,botId,guildId,messages:[starter]};
 test('allow single source-link in original bot-owned '+key+' thread, adopt exact receipt',()=>{
  assert.deepEqual(assessPlecoNomenclatureIndex(args),{mode:'create',messageId:null});
  const posted={id:'1563999999999999999',author:{id:botId},content:plan.content};
  assert.deepEqual(assessPlecoNomenclatureIndex({...args,messages:[posted,starter]}),{mode:'adopt',messageId:posted.id});
 });
 test('reject archived, private, different author, partial history and duplicate site URLs for '+key,()=>{
  for(const bad of [
   {...args,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
   {...args,thread:{...thread,name:'Someone else'}},
   {...args,parent:{...parent,permission_overwrites:[{id:guildId,deny:'1024'}]}},
   {...args,messages:[{...starter,author:{id:'other'}}]},
   {...args,messages:[starter,{id:'x',author:{id:botId},content:plan.pageUrl}]},
   {...args,messages:Array.from({length:100},(_,i)=>({...starter,id:String(i)}))}
  ])assert.throws(()=>assessPlecoNomenclatureIndex(bad),/Pleco nomenclature guard/);
 });
}
