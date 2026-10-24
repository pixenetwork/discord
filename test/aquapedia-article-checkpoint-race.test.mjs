import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('  let lock;');
const end=source.indexOf('  let posted=0,updated=0,unchanged=0,adopted=0;',start);
assert.ok(start>=0&&end>start,'Extract real lock acquisition + checkpoint verification');
const acquire=new Function('fs','lockFile','process','mode','file','checkpointSnapshot',
 source.slice(start,end)+'return lock;');

const lockFile='data/aquapedia-autosync-writer.lock';
const file='data/aquapedia-article-content-checkpoint.v1.json';
function setup(latest){
 const events=[];
 const mock={
  openSync:(p,flags)=>{events.push('open:'+flags);return 77},
  writeSync:()=>events.push('owner'),
  readFileSync:(p)=>{assert.equal(p,file);events.push('checkpoint-read');return latest},
  closeSync:()=>events.push('close'),
  unlinkSync:()=>events.push('unlink')
 };
 return {mock,events};
}
test('checkpoint changed while waiting for writer lock must fail closed and release OUR lock',()=>{
 const h=setup('NEW-CHECKPOINT');
 assert.throws(()=>acquire(h.mock,lockFile,{pid:77},'apply',file,'PRE-FLIGHT-CHECKPOINT'),
  /checkpoint changed during preflight/i);
 assert.deepEqual(h.events,['open:wx','owner','checkpoint-read','close','unlink']);
});
test('unchanged checkpoint is re-read after acquiring writer lock',()=>{
 const h=setup('PRE-FLIGHT-CHECKPOINT');
 assert.equal(acquire(h.mock,lockFile,{pid:77},'apply',file,'PRE-FLIGHT-CHECKPOINT'),77);
 assert.deepEqual(h.events,['open:wx','owner','checkpoint-read']);
});
