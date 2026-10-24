import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessPlecoTaxonomyIndex} from '../src/aquapedia-pleco-seven-taxonomy-guard.mjs';
import {buildPlecoTaxonomySourceIndex} from '../src/aquapedia-pleco-seven-taxonomy-index.mjs';
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
const plan=buildPlecoTaxonomySourceIndex(source,'bary-hadrostomus'),botId='1535522109571203152',guildId='1519337502379475095';
const thread={id:plan.threadId,name:plan.threadName,parent_id:'1560931428680601630',thread_metadata:{archived:false,locked:false}};
const parent={id:thread.parent_id,type:15,permission_overwrites:[]};
const starter={id:plan.threadId,author:{id:botId},content:'Source citations'};
const base={plan,botId,guildId,thread,parent,messages:[starter]};
test('may create one source-only index in original bot thread or adopt exact previous message',()=>{
 assert.deepEqual(assessPlecoTaxonomyIndex(base),{mode:'create',messageId:null});
 const previous={id:'1563000000000000000',author:{id:botId},content:plan.content};
 assert.deepEqual(assessPlecoTaxonomyIndex({...base,messages:[previous,starter]}),{mode:'adopt',messageId:previous.id});
});
test('fails closed on renamed, locked, archived, hidden or wrongly owned targets and duplicate links',()=>{
 const failures=[
  {...base,thread:{...thread,name:'Wrong fish'}},
  {...base,thread:{...thread,thread_metadata:{archived:true,locked:false}}},
  {...base,thread:{...thread,thread_metadata:{archived:false,locked:true}}},
  {...base,parent:{...parent,id:'999999999999999999'}},
  {...base,parent:{...parent,permission_overwrites:[{id:guildId,deny:'1024'}]}},
  {...base,messages:[{...starter,author:{id:'other'}}]},
  {...base,messages:[starter,{id:'other',author:{id:botId},content:plan.pageUrl}]},
  {...base,messages:[starter,{id:'other',author:{id:'other'},content:plan.content}]}
 ];
 for(const state of failures)assert.throws(()=>assessPlecoTaxonomyIndex(state),/Pleco taxonomy link guard/);
});
test('no ambiguous full message window can bypass duplicate checks',()=>{
 const longer=[starter,...Array.from({length:99},(_,i)=>({id:String(i+1),author:{id:botId},content:'old'}))];
 assert.throws(()=>assessPlecoTaxonomyIndex({...base,messages:longer}),/Pleco taxonomy link guard/);
});
