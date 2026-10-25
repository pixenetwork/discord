import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=text.indexOf('function saveAtomically(v){');
const end=text.indexOf('function pagePath(v){',start);
assert.ok(start>=0&&end>start,'Locate actual atomic checkpoint writer');
const factory=new Function('fs','path','file','process','randomUUID',text.slice(start,end)+'return saveAtomically;');

test('different checkpoint saves use distinct exclusive private temp files',()=>{
 const writes=[];
 const fake={
  mkdirSync:()=>{},
  writeFileSync:(name,content,options)=>{writes.push({name,content,options})},
  renameSync:()=>{}
 };
 let sequence=0;
 const save=factory(fake,path,'data/checkpoint.json',{pid:77},()=>('n'+ ++sequence));
 save({a:1});save({a:2});
 assert.equal(writes.length,2);
 assert.notEqual(writes[0].name,writes[1].name);
 assert.ok(writes.every(w=>w.options.flag==='wx'));
 assert.match(writes[0].name,/n1/);
 assert.match(writes[1].name,/n2/);
});
test('failed rename removes only the temporary checkpoint and keeps original failure',()=>{
 const events=[];
 const fake={
  mkdirSync:()=>{},
  writeFileSync:(n)=>{events.push('write:'+n)},
  renameSync:()=>{events.push('rename');throw Error('rename-failure')},
  unlinkSync:(n)=>events.push('remove:'+n)
 };
 const save=factory(fake,path,'data/checkpoint.json',{pid:77},()=> 'unique');
 assert.throws(()=>save({a:1}),/rename-failure/);
 assert.deepEqual(events,['write:data/checkpoint.json.tmp-77-unique','rename','remove:data/checkpoint.json.tmp-77-unique']);
});
