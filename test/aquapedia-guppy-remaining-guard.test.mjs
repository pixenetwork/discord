import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessRemainingGuppyPost} from '../src/aquapedia-guppy-remaining-guard.mjs';
import {buildRemainingGuppyIndex,GUPPY_REMAINING_TOPIC_SPECS} from '../src/aquapedia-guppy-remaining-index.mjs';
const records=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-source-20261021.json',import.meta.url),'utf8'));
const bot='1535522109571203152',guild='1519337502379475095';
const setup=topic=>{
 const plan=buildRemainingGuppyIndex(records,topic);
 const thread={id:plan.threadId,name:plan.threadName,parent_id:'1562195139353645146',thread_metadata:{archived:false,locked:false}};
 const parent={id:thread.parent_id,type:15,permission_overwrites:[]};
 const starter={id:thread.id,author:{id:bot},content:'original bot starter'};
 return {plan,botId:bot,guildId:guild,thread,parent,messages:[starter]};
};
test('remaining indexes only create in authorized existing bot topic or adopt exact prior post',()=>{
 for(const topic of Object.keys(GUPPY_REMAINING_TOPIC_SPECS)){
  const input=setup(topic);
  assert.equal(assessRemainingGuppyPost(input).mode,'create');
  const old={id:'1563000000000000001',author:{id:bot},content:input.plan.content};
  assert.deepEqual(assessRemainingGuppyPost({...input,messages:[old,...input.messages]}),{mode:'adopt',existingId:old.id});
 }
});
test('missing starter, duplicate text, wrong author, archived or locked state fail closed',()=>{
 const input=setup('cover-one');
 const bad=[
 {...input,messages:[]},
 {...input,messages:[{id:'xx',author:{id:bot},content:'no starter'}]},
 {...input,messages:[...input.messages,{id:'y',author:{id:bot},content:input.plan.entryUrls[0]}]},
 {...input,messages:[...input.messages,{id:'y',author:{id:'other'},content:input.plan.content}]},
 {...input,thread:{...input.thread,thread_metadata:{archived:true,locked:false}}},
 {...input,thread:{...input.thread,thread_metadata:{archived:false,locked:true}}},
 {...input,parent:{...input.parent,permission_overwrites:[{id:guild,deny:'1024'}]}}
 ];
 for(const item of bad)assert.throws(()=>assessRemainingGuppyPost(item),/Guppy remaining release guard/);
});
