import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBreederInbox,pruneBreederInbox} from '../src/breeder-inbox.mjs';
test('reconsent preserves messages, delisted participant can STOP, orphan tmp removed',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'aq-review-'));
 let now=100000;
 const user='100000000000000003';
 const message=(id,content)=>({id,author:{id:user,bot:false},guildId:null,content,createdAt:new Date(now)});
 const inbox=createBreederInbox({recipientIds:[user],outputDir:dir,now:()=>now});
 const file=path.join(dir,'breeder-inbox.json');
 try {
  await inbox(message('200000000000000001','I consent to Aquapedia storing my interview DMs for 30 days.'));
  await inbox(message('200000000000000002','My history'));
  const before=JSON.parse(await readFile(file,'utf8'));
  await inbox(message('200000000000000003','I consent to Aquapedia storing my interview DMs for 30 days.'));
  const after=JSON.parse(await readFile(file,'utf8'));
  assert.equal(after[0].messages.length,1);
  assert.equal(after[0].expiresAt,before[0].expiresAt);
  const orphan=file+'.1234-abcd.tmp';
  await writeFile(orphan,'private stale copy');
  await pruneBreederInbox({outputDir:dir,now:()=>now});
  assert.equal((await readdir(dir)).some(n=>n.endsWith('.tmp')),false);
  const delisted=createBreederInbox({recipientIds:[],outputDir:dir,now:()=>now});
  assert.equal(await delisted(message('200000000000000004','STOP AQUAPEDIA RECORDING')),true);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),[]);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
