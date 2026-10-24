import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('  let lock;');
const end=src.indexOf('  let posted=0,updated=0,unchanged=0,adopted=0;',start);
assert.ok(start>=0&&end>start,'Find actual writer-lock acquisition and owner-write code');
const acquire=new Function('fs','lockFile','process','mode','file','checkpointSnapshot',src.slice(start,end)+'return lock;');
const lockFile='data/aquapedia-autosync-writer.lock';

test('lock open failure must not unlink a lock this process does not own',()=>{
 const events=[];
 const mock={
  openSync:()=>{events.push('open');throw Object.assign(Error('already held'),{code:'EEXIST'})},
  closeSync:()=>events.push('close'),
  unlinkSync:()=>events.push('unlink'),
  writeSync:()=>events.push('write')
 };
 assert.throws(()=>acquire(mock,lockFile,{pid:123},'apply','checkpoint.json','snapshot'),/Existing sync publisher could not acquire or record writer lock/);
 assert.deepEqual(events,['open']);
});
test('ownership metadata write failure cleans up newly acquired lock',()=>{
 const events=[];
 const mock={
  openSync:()=>{events.push('open');return 77},
  writeSync:()=>{events.push('write');throw Object.assign(Error('disk write failed'),{code:'EIO'})},
  closeSync:fd=>events.push('close:'+fd),
  unlinkSync:p=>events.push('unlink:'+p)
 };
 assert.throws(()=>acquire(mock,lockFile,{pid:123},'apply','checkpoint.json','snapshot'),/Existing sync publisher could not acquire or record writer lock/);
 assert.deepEqual(events,['open','write','close:77','unlink:'+lockFile]);
});
test('successful acquisition retains the lock for the publication loop',()=>{
 const events=[];
 const mock={
  openSync:(p,f)=>{events.push('open:'+p+':'+f);return 44},
  writeSync:(fd,s)=>{events.push('owner:'+fd);assert.equal(JSON.parse(s).pid,123)},
  readFileSync:p=>{assert.equal(p,'checkpoint.json');events.push('checkpoint-read');return 'snapshot'},
  closeSync:()=>events.push('close'),
  unlinkSync:()=>events.push('unlink')
 };
 assert.equal(acquire(mock,lockFile,{pid:123},'apply','checkpoint.json','snapshot'),44);
 assert.deepEqual(events,['open:'+lockFile+':wx','owner:44','checkpoint-read']);
});
