import test from 'node:test';
import assert from 'node:assert/strict';
import {probePublicThreadCapacity,PUBLIC_THREAD_SOFT_LIMIT} from '../src/thread-capacity.mjs';
function guild(n){return {channels:{async fetchActiveThreads(){return {threads:{size:n}};}}};}
test('reserves 50 active guild slots; permits 949 but blocks 950 and 1000',async()=>{
 assert.equal(PUBLIC_THREAD_SOFT_LIMIT,950);
 assert.deepEqual((await probePublicThreadCapacity(guild(949))).allowed,true);
 for(const n of [950,966,1000]){
  const x=await probePublicThreadCapacity(guild(n));
  assert.equal(x.allowed,false);
  assert.equal(x.reason,'guild_active_thread_soft_limit');
 }
});
test('no access, bad API output and API failure fail closed',async()=>{
 const fixtures=[
  {},{channels:{}},{channels:{async fetchActiveThreads(){return {threads:null};}}},
  {channels:{async fetchActiveThreads(){throw Error('403');}}}
 ];
 for(const g of fixtures){const p=await probePublicThreadCapacity(g);assert.equal(p.allowed,false);}
});
test('soft limit controls can only be within Discord upper-bound',async()=>{
 await assert.rejects(()=>probePublicThreadCapacity(guild(5),{softLimit:1001}),RangeError);
});
