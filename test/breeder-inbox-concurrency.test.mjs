import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBreederInbox,pruneBreederInbox} from '../src/breeder-inbox.mjs';
test('concurrent messages do not overwrite each other; expiration clears records', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'aq-race-'));
 let now=100000;
 try {
  const receive=createBreederInbox({recipientIds:['100000000000000003'],outputDir:dir,now:()=>now,retentionDays:1});
  const message=(id,content)=>({id,author:{id:'100000000000000003',bot:false},guildId:null,content,createdAt:new Date(now)});
  assert.equal(await receive(message('200000000000000001','private before consent')),false);
  await assert.rejects(readFile(path.join(dir,'breeder-inbox.json'),'utf8'), {code:'ENOENT'});
  await receive(message('200000000000000002','I consent to Aquapedia storing my interview DMs for 30 days.'));
  await Promise.all(Array.from({length:10},(_,i)=>receive(message(String(200000000000000010n+BigInt(i)),'note '+i))));
  const rows=JSON.parse(await readFile(path.join(dir,'breeder-inbox.json'),'utf8'));
  assert.equal(rows[0].messages.length,10);
  now+=86400001;
  assert.equal(await pruneBreederInbox({outputDir:dir,now:()=>now}),1);
  const cleared=JSON.parse(await readFile(path.join(dir,'breeder-inbox.json'),'utf8'));
  assert.equal(cleared.length,0);
 } finally {await rm(dir,{recursive:true,force:true});}
});
