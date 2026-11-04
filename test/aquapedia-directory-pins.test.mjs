import test from 'node:test';
import assert from 'node:assert/strict';

const mod=await import('../src/aquapedia-directory.mjs');

test('directory lookup paginates the current Discord pins collection',async()=>{
 assert.equal(typeof mod.findPinnedDirectoryMessages,'function','pin paginator must be exported');
 const calls=[];
 const marker=mod.DIRECTORY_MARKER;
 const request=async(method,endpoint)=>{
  calls.push([method,endpoint]);
  if(calls.length===1)return {items:[{pinned_at:'2026-11-04T01:00:00.000Z',message:{id:'new',content:'other'}}],has_more:true};
  return {items:[{pinned_at:'2026-10-01T01:00:00.000Z',message:{id:'old',content:marker+' legacy canonical'}}],has_more:false};
 };
 const prior=await mod.findPinnedDirectoryMessages(request,'hub');
 assert.deepEqual(prior.map(x=>x.id),['old']);
 assert.equal(calls[0][1],'/channels/hub/messages/pins?limit=50');
 assert.match(calls[1][1],/^\/channels\/hub\/messages\/pins\?limit=50&before=/);
});

test('canonical index lookup includes pins plus recent history and refuses unknown older history',async()=>{
 assert.equal(typeof mod.findDirectoryIndexPosts,'function','canonical index search must be exported');
 const marker=mod.DIRECTORY_MARKER;
 const pinned=await mod.findDirectoryIndexPosts(async(_method,endpoint)=>{
  if(endpoint.includes('/messages/pins?'))return {items:[{pinned_at:'2026-10-01T00:00:00.000Z',message:{id:'canonical',content:marker,author:{id:'bot'}}}],has_more:false};
  return Array.from({length:100},(_,i)=>({id:'recent-'+i,content:'other'}));
 },'hub');
 assert.deepEqual(pinned.map(x=>x.id),['canonical']);

 await assert.rejects(
  mod.findDirectoryIndexPosts(async(_method,endpoint)=>{
   if(endpoint.includes('/messages/pins?'))return {items:[],has_more:false};
   return Array.from({length:100},(_,i)=>({id:'recent-'+i,content:'other'}));
  },'hub'),
  /older|history|unknown|complete/i
 );
});

test('canonical index lookup refuses duplicate markers across pins and recent history',async()=>{
 const marker=mod.DIRECTORY_MARKER;
 await assert.rejects(
  mod.findDirectoryIndexPosts(async(_method,endpoint)=>{
   if(endpoint.includes('/messages/pins?'))return {items:[{pinned_at:'2026-10-01T00:00:00.000Z',message:{id:'pin',content:marker}}],has_more:false};
   return [{id:'recent',content:marker}];
  },'hub'),
  /duplicate/i
 );
});
