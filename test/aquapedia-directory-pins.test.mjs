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
