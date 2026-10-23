import test from 'node:test';
import assert from 'node:assert/strict';
import {evidencePacket,refreshRecord} from '../tools/corydoras-forum-publisher.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Corydoradinae evidence publisher packet is a single safe source-linked research update',()=>{
  const p=evidencePacket();
  assert.ok(p.content.length>800 && p.content.length<=2000);
  for(let n=1;n<=8;n++)assert.ok(p.content.includes('\n'+n+'. **'));
  assert.ok(p.content.includes('Research draft'));
  assert.ok(p.content.includes('https://doi.org/10.1093/zoolinnean/zlaf035'));
  assert.ok(p.content.includes('https://doi.org/10.1007/BF00002344'));
  assert.ok(p.content.includes('https://doi.org/10.1038/nature09660'));
  assert.equal(p.embeds.length,1);
  assert.ok(p.embeds[0].footer.text.startsWith('AQP-CORY-evidence-eight-topics-20261019'));
  assert.deepEqual(p.allowedMentions.parse,[]);
  assert.ok(!p.content.includes('discord.com/channels/'));
  assert.ok(!p.content.includes('github.com/pixenetwork/aquapedia'));
  assert.ok(!p.files);
});

test('existing evidence thread safely updates in place and readbacks without a duplicate post',async()=>{
 const key='evidence-eight-topics-20261019',title='Corydoradinae Evidence Desk - Eight Research Areas',author='bot-fixture';
 const packet=evidencePacket();
 const receipts=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'cory-evidence-')),'receipts.jsonl');
 let edits=0,fetches=0,body='previous eight-topic summary';
 const starter={id:'message-1',author:{id:author},get content(){return body;},embeds:[{footer:{text:'AQP-CORY-'+key+' • research draft'}}],edit:async payload=>{edits++;body=payload.content;}};
 const thread={id:'thread-1',fetchStarterMessage:async()=>starter,messages:{fetch:async opts=>{fetches++;assert.equal(opts.force,true);return starter;}}};
 const guildForum={id:'forum-1',guild:{id:'guild-1'}};
 const threads=new Map([[title,thread]]);
 const rec={id:key,name:title};
 try{
  const first=await refreshRecord(guildForum,threads,rec,author,receipts,()=>packet);
  assert.equal(first.action,'updated');
  assert.equal(edits,1);
  assert.equal(first.threadId,'thread-1');
  assert.equal(first.verified,true);
  const second=await refreshRecord(guildForum,threads,rec,author,receipts,()=>packet);
  assert.equal(second.action,'unchanged');
  assert.equal(edits,1);
  assert.equal(fetches,2);
  assert.equal(fs.readFileSync(receipts,'utf8').trim().split('\n').length,1);
 }finally{fs.rmSync(path.dirname(receipts),{recursive:true,force:true});}
});
test('evidence refresh rejects a thread not authored by the configured bot',async()=>{
 const title='Corydoradinae Evidence Desk - Eight Research Areas';
 const thread={id:'th',fetchStarterMessage:async()=>({id:'starter',author:{id:'different'},embeds:[{footer:{text:'AQP-CORY-evidence-eight-topics-20261019'}}]})};
 await assert.rejects(refreshRecord({id:'forum',guild:{id:'guild'}},new Map([[title,thread]]),{id:'evidence-eight-topics-20261019',name:title},'bot-owner',path.join(os.tmpdir(),'cory-evidence-unused'),evidencePacket),/ownership\/marker mismatch/);
});
