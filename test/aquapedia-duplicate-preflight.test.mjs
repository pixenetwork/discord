import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLegacyForums,LEGACY_FORUMS,INTRO_ID,SPECIES_ID} from '../src/aquapedia-duplicate-preflight.mjs';

const fixture=()=>{
 const channels=[
  {id:INTRO_ID,name:'📚・AQUAPEDIA',type:4},
  {id:SPECIES_ID,name:'🧬・AQUAPEDIA — SPECIES & GENETICS',type:4},
  ...LEGACY_FORUMS.flatMap(s=>[
   {id:s.id,type:15,parent_id:INTRO_ID,name:s.name},
   {id:s.canonicalId,type:15,parent_id:SPECIES_ID,name:s.name},
  ]),
 ];
 const archivedById=Object.fromEntries(LEGACY_FORUMS.map(s=>[s.id,{count:0,hasMore:false}]));
 const directories=Array.from({length:6},(_,i)=>({id:'directory-'+i,content:'canonical research indexes'}));
 return {guildId:'1519337502379475095',channels,activeThreads:[],archivedById,directories};
};
test('GET evidence makes an empty, unlinked legacy forum a candidate, never an authorized change',()=>{
 const v=assessLegacyForums(fixture());
 assert.equal(v.status,'PREFLIGHT_OK');
 assert.equal(v.snapshots.length,2);
 assert.match(v.note,/not approval/);
});
test('archived thread or missing pagination blocks the candidate',()=>{
 const x=fixture();x.archivedById[LEGACY_FORUMS[0].id].count=1;
 assert.equal(assessLegacyForums(x).status,'HOLD');
 x.archivedById[LEGACY_FORUMS[0].id].count=0;x.archivedById[LEGACY_FORUMS[0].id].hasMore=true;
 assert.equal(assessLegacyForums(x).status,'HOLD');
});
test('active threads, changed ids, directory links, conflicting names or missing directory checks fail closed',()=>{
 for(const mode of ['active','forum','link','name','directory']){
  const x=fixture();const f=LEGACY_FORUMS[0];
  if(mode==='active') x.activeThreads.push({parent_id:f.id});
  if(mode==='forum') x.channels.find(c=>c.id===f.id).name='changed';
  if(mode==='link') x.directories[0].content='https://discord.com/channels/1519337502379475095/'+f.id;
  if(mode==='name') x.channels.push({id:'another',name:f.proposedName});
  if(mode==='directory') x.directories.pop();
  assert.equal(assessLegacyForums(x).status,'HOLD',mode);
 }
});
