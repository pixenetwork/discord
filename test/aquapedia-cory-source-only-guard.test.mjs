import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessCorySourceOnlyTarget} from '../src/aquapedia-cory-source-only-guard.mjs';
import {buildCorySourceOnlyBacklink} from '../src/aquapedia-cory-source-only-backlink.mjs';
const records=JSON.parse(fs.readFileSync(new URL('./fixtures/corydoraspedia-thread-review-20261021.json',import.meta.url),'utf8')).records.map(r=>({...r,group:'corydoras'}));
const plan=buildCorySourceOnlyBacklink(records,'burgessi');
const botId='1535522109571203152',guildId='1519337502379475095';
const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560887812910350339',thread_metadata:{archived:false,locked:false}};
const parent={id:thread.parent_id,type:15,permission_overwrites:[]};
const starter={id:thread.id,author:{id:botId},content:'research starter with original taxonomy sources'};
const initial={plan,botId,guildId,thread,parent,messages:[starter]};
test('unmodified public bot starter may receive a source-only reference, and exact previous message is adopted',()=>{
 assert.equal(assessCorySourceOnlyTarget(initial).mode,'create');
 const posted={id:'1563019999999999999',author:{id:botId},content:plan.content};
 assert.deepEqual(assessCorySourceOnlyTarget({...initial,messages:[posted,starter]}),{mode:'adopt',messageId:posted.id});
});
test('locked, archived, unclear duplicates, unrelated bot, or wrong forum fail closed',()=>{
 for(const bad of [
  {...initial,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
  {...initial,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
  {...initial,messages:[{...starter,author:{id:'other'}}]},
  {...initial,messages:[starter,{id:'x',author:{id:botId},content:plan.pageUrl}]},
  {...initial,messages:[starter,{id:'x',author:{id:'other'},content:plan.content}]},
  {...initial,parent:{...parent,id:'999999999999999999'}}
 ])assert.throws(()=>assessCorySourceOnlyTarget(bad),/Cory source-only guard/);
});
