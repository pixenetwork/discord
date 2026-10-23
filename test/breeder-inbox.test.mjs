import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBreederInbox} from '../src/breeder-inbox.mjs';
test('requires explicit consent; supports revoke, expiry, and unrelated-user rejection',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'aq-inbox-'));
 try{
  let t=100000;
  const receive=createBreederInbox({recipientIds:['100000000000000003'],outputDir:dir,now:()=>t});
  const msg=(id,content,authorId='100000000000000003')=>({id,guildId:null,author:{id:authorId,bot:false},content,createdAt:new Date(t)});
  assert.equal(await receive(msg('200000000000000001','private text')),false);
  assert.equal(await receive(msg('200000000000000002','I consent to Aquapedia storing my interview DMs for 30 days.','100000000000000004')),false);
  assert.equal(await receive(msg('200000000000000003','I consent to Aquapedia storing my interview DMs for 30 days.')),true);
  assert.equal(await receive(msg('200000000000000004','Breeding details')),true);
  let rows=JSON.parse(await readFile(path.join(dir,'breeder-inbox.json'),'utf8'));
  assert.equal(rows[0].messages[0].content,'Breeding details');
  assert.equal(await receive(msg('200000000000000005','STOP AQUAPEDIA RECORDING')),true);
  rows=JSON.parse(await readFile(path.join(dir,'breeder-inbox.json'),'utf8'));assert.equal(rows.length,0);
  assert.equal(await receive(msg('200000000000000006','More details')),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
