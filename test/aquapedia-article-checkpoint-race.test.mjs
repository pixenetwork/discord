import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('  let lock;');
const end=source.indexOf('  let posted=0,updated=0,unchanged=0,adopted=0;',start);
assert.ok(start>=0&&end>start,'Extract real lock acquisition + checkpoint verification');
const acquire=new Function('fs','lockFile','process','mode','file','checkpointSnapshot','priorFile','priorSnapshot',
 source.slice(start,end)+'return lock;');

const lockFile='data/aquapedia-autosync-writer.lock';
const file='data/aquapedia-article-content-checkpoint.v1.json';
const priorFile='data/aquapedia-autosync-state.v1.json';
const checkpointSnapshot='PRE-FLIGHT-CHECKPOINT',priorSnapshot='PRE-FLIGHT-METADATA';

function setup({article=checkpointSnapshot,metadata=priorSnapshot}={}){
 const events=[];
 const mock={
  openSync:(p,flags)=>{events.push('open:'+flags);return 77},
  writeSync:()=>events.push('owner'),
  readFileSync:p=>{
   if(p===file){events.push('checkpoint-read');return article;}
   if(p===priorFile){events.push('metadata-read');return metadata;}
   throw Error('Unexpected read: '+p);
  },
  closeSync:()=>events.push('close'),
  unlinkSync:()=>events.push('unlink')
 };
 const run=()=>acquire(mock,lockFile,{pid:77},'apply',file,checkpointSnapshot,priorFile,priorSnapshot);
 return {mock,events,run};
}

test('article checkpoint changed while waiting for writer lock must fail closed and release OUR lock',()=>{
 const h=setup({article:'NEW-CHECKPOINT'});
 assert.throws(h.run,/checkpoint changed during preflight/i);
 assert.deepEqual(h.events,['open:wx','owner','checkpoint-read','close','unlink']);
});
test('metadata baseline changed while waiting for writer lock must also fail closed',()=>{
 const h=setup({metadata:'NEW-METADATA'});
 assert.throws(h.run,/metadata baseline changed during preflight/i);
 assert.deepEqual(h.events,['open:wx','owner','checkpoint-read','metadata-read','close','unlink']);
});
test('unchanged article and metadata snapshots are re-read after acquiring writer lock',()=>{
 const h=setup();
 assert.equal(h.run(),77);
 assert.deepEqual(h.events,['open:wx','owner','checkpoint-read','metadata-read']);
});
