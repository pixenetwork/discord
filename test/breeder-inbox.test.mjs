import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBreederInbox } from '../src/breeder-inbox.mjs';
test('only captures verified breeder direct messages', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'aq-inbox-'));
 try {
  const receive=createBreederInbox({recipientIds:['1202839835849662465'],outputDir:dir});
  const msg={id:'1562213400833036339',guildId:null,author:{id:'1202839835849662465',bot:false},content:'Thanks for reaching out!',createdAt:new Date('2026-10-20T21:00:00Z'),attachments:new Map()};
  assert.equal(await receive({...msg,guildId:'1519337502379475095'}),false);
  assert.equal(await receive({...msg,author:{id:'400761183931727873'}}),false);
  assert.equal(await receive(msg),true);
  const lines=(await readFile(path.join(dir,'breeder-inbox.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(lines.length,1);
  assert.equal(lines[0].content,'Thanks for reaching out!');
 }finally{await rm(dir,{recursive:true,force:true});}
});
