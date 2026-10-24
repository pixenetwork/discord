import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGuppyDiscordIndexPreview,GUPPY_FORUM_ID,GUPPY_EXISTING_THREADS} from '../src/aquapedia-guppy-discord-index-preview.mjs';

const guppies=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-source-20261021.json',import.meta.url),'utf8'));
const manifest=()=>GUPPY_EXISTING_THREADS.map(t=>({...t,parentId:GUPPY_FORUM_ID,starterOwnedByBot:true,archived:false,locked:false,starterContent:'Aquapedia: https://aquapedia.app'+t.page}));
test('source-linked 48-entry Guppy preview fits existing threads without creating new ones',()=>{
 const p=buildGuppyDiscordIndexPreview(guppies,manifest(),{guildActiveThreads:896});
 assert.equal(p.publicationAuthorized,false);
 assert.equal(p.newThreadsToCreate,0);
 assert.equal(p.recordsIndexed,48);
 assert.equal(p.tradeRecordsHeld,128);
 assert.deepEqual(p.groups,{base:10,cover:25,tail:13});
 assert.ok(p.messages.length>=3 && p.messages.length<=6);
 assert.deepEqual([...new Set(p.messages.map(x=>x.threadId))].sort(),[GUPPY_EXISTING_THREADS.find(x=>x.key==='genetics').id,GUPPY_EXISTING_THREADS.find(x=>x.key==='standards').id].sort());
 assert.ok(p.messages.every(m=>m.content.length<=1900 && m.content.length>100));
 assert.ok(p.messages.every(m=>m.recordIds.every(id=>/^gup-\d{3}$/.test(id))));
 assert.equal(new Set(p.messages.flatMap(m=>m.recordIds)).size,48);
 assert.equal(p.messages.flatMap(x=>x.recordIds).length,48);
 assert.ok(p.messages.every(m=>m.content.includes('Not a verified pedigree')));
 assert.ok(p.messages.every(m=>m.content.includes('https://aquapedia.app/guppypedia/entries/')));
 assert.ok(p.messages.every(m=>!m.content.includes('@everyone')&&!m.content.includes('@here')));
});
test('read-only planner fails closed if any of seven current bot starter threads are missing or unverifiable',()=>{
 const f=manifest();
 for(const bad of [
  f.slice(0,6),
  f.map((x,i)=>i===0?{...x,id:'0'}:x),
  f.map((x,i)=>i===1?{...x,parentId:'123'}:x),
  f.map((x,i)=>i===2?{...x,starterOwnedByBot:false}:x),
  f.map((x,i)=>i===3?{...x,locked:true}:x),
  f.map((x,i)=>i===4?{...x,starterContent:'unverified'}:x),
  [...f,f[0]]
 ])assert.throws(()=>buildGuppyDiscordIndexPreview(guppies,bad,{guildActiveThreads:896}),/Guppy index preview/);
});
test('source drift and unsafe thread-capacity conditions prohibit proposal',()=>{
 assert.throws(()=>buildGuppyDiscordIndexPreview(guppies.slice(1),manifest(),{guildActiveThreads:896}),/Guppy index preview|IKGH crosswalk/);
 assert.throws(()=>buildGuppyDiscordIndexPreview(guppies,manifest(),{guildActiveThreads:950}),/Guppy index preview/);
 assert.throws(()=>buildGuppyDiscordIndexPreview(guppies,manifest(),{guildActiveThreads:undefined}),/Guppy index preview/);
});
test('index proposal does not admit separate-species or commercial lines as standardized traits',()=>{
 const p=buildGuppyDiscordIndexPreview(guppies,manifest(),{guildActiveThreads:896});
 for(const id of ['gup-049','gup-071','gup-141','gup-147','gup-175']){
  assert.ok(!p.messages.some(x=>x.recordIds.includes(id)));
 }
});

test('captured public Discord starter snapshots independently confirm seven destinations',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('./fixtures/guppypedia-forum-starters-20261021.json',import.meta.url),'utf8'));
 assert.match(snapshot.capturedAt,/^2026-10-21T/);
 assert.match(snapshot.botUserId,/^\d+$/);
 const p=buildGuppyDiscordIndexPreview(guppies,snapshot.threads,{guildActiveThreads:896});
 assert.equal(p.recordsIndexed,48);
 assert.equal(p.publicationAuthorized,false);
 assert.equal(p.tradeRecordsHeld,128);
 assert.ok(snapshot.threads.every(x=>x.starterMessageId===x.id));
 const altered=snapshot.threads.map((x,i)=>i===2?{...x,starterOwnedByBot:false}:x);
 assert.throws(()=>buildGuppyDiscordIndexPreview(guppies,altered,{guildActiveThreads:896}),/Guppy index preview/);
});
