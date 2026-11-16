import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandRouter, aquapediaOnlyCommandNames } from '../src/commands.mjs';

test('Aquapedia-only mode registers only educational commands',()=>{
 const previous=process.env.AQUAPEDIA_ONLY;
 try{
  process.env.AQUAPEDIA_ONLY='true';
  const commands=createCommandRouter({ config:{discord:{ownerUserId:'owner'}},store:{} }).definitions;
  assert.deepEqual(commands.map(x=>x.name).sort(), aquapediaOnlyCommandNames().sort());
  for(const forbidden of ['aquaphoria','vendor','catalog','product','order','payout','ticket']) {
   assert.ok(!commands.some(x=>x.name===forbidden),forbidden);
  }
 }finally{
  if(previous===undefined) delete process.env.AQUAPEDIA_ONLY;
  else process.env.AQUAPEDIA_ONLY=previous;
 }
});
test('Aquapedia-only mode refuses stale commerce interactions before mutation',async()=>{
 const previous=process.env.AQUAPEDIA_ONLY;
 try{
  process.env.AQUAPEDIA_ONLY='true';
  const replies=[];
  const router=createCommandRouter({config:{discord:{ownerUserId:'owner'}},store:{}});
  await router.handle({isChatInputCommand:()=>true,commandName:'vendor',user:{id:'owner'},
   reply:async x=>{replies.push(x)},guild:{channels:{cache:new Map()}}});
  assert.equal(replies.length,1);
  assert.equal(replies[0].ephemeral,true);
  assert.match(replies[0].content,/Aquapedia-only/);
 } finally{
  if(previous===undefined) delete process.env.AQUAPEDIA_ONLY;
  else process.env.AQUAPEDIA_ONLY=previous;
 }
});
