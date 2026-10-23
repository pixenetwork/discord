import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessGuppySourceOnlyCanary} from '../src/aquapedia-guppy-source-only-guard.mjs';
import {buildGuppyBaseIndexCanary} from '../src/aquapedia-guppy-base-index-canary.mjs';
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-source-20261021.json',import.meta.url),'utf8'));
const plan=buildGuppyBaseIndexCanary(source);
const botId='111111111111111111';
const thread={id:plan.threadId,parent_id:'1562195139353645146',name:'Guppypedia — Genetics and Lineage',thread_metadata:{archived:false,locked:false}};
const parent={id:'1562195139353645146',type:15,permission_overwrites:[]};
const starter={id:plan.threadId,author:{id:botId},content:'Existing original forum topic and research source citations'};
const base={plan,botId,thread,parent,messages:[starter],guildId:'1519337502379475095'};
test('bot-owned unlocked public destination authorizes only a single source-index create action',()=>{
 assert.deepEqual(assessGuppySourceOnlyCanary(base),{mode:'create',existingMessageId:null});
});
test('matching bot-authored prior canary is adopted without duplicate writes',()=>{
 const previous={id:'222222222222222222',author:{id:botId},content:plan.content};
 assert.deepEqual(assessGuppySourceOnlyCanary({...base,messages:[previous,starter]}),{mode:'adopt',existingMessageId:previous.id});
});
test('non-bot starter, archived, locked, hidden or renamed destinations are refused',()=>{
 for(const args of [
  {...base,messages:[{...starter,author:{id:'other'}}]},
  {...base,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
  {...base,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
  {...base,thread:{...thread,name:'Different forum'}},
  {...base,parent:{...parent,permission_overwrites:[{id:base.guildId,deny:'1024'}]}},
  {...base,parent:{...parent,type:0}}
 ])assert.throws(()=>assessGuppySourceOnlyCanary(args),/Guppy canary guard/);
});
test('unclear existing reference, other-author marker, or modified marker refuses duplicate publication',()=>{
 for(const content of [
  'Referenced https://aquapedia.app/guppypedia/entries/gup-001/ previously',
  'Wrong text '+plan.marker
 ]){
  assert.throws(()=>assessGuppySourceOnlyCanary({...base,messages:[{id:'333333333333333333',author:{id:botId},content},starter]}),/Guppy canary guard/);
 }
 assert.throws(()=>assessGuppySourceOnlyCanary({...base,messages:[{id:'333333333333333333',author:{id:'other'},content:plan.content},starter]}),/Guppy canary guard/);
});
test('full/recent history that cannot establish originality must be refused',()=>{
 const huge=Array.from({length:100},(_,i)=>({id:String(i),author:{id:botId},content:'unrelated'}));
 assert.throws(()=>assessGuppySourceOnlyCanary({...base,messages:huge}),/Guppy canary guard/);
});
