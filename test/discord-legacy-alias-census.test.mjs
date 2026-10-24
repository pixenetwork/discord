import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../tools/discord-legacy-alias-census.mjs',import.meta.url));
const guild='1519337502379475095';
function snapshot() {
 const hold={id:'hold',type:4,name:'MIGRATION HOLD',permission_overwrites:[{id:guild,type:0,allow:'0',deny:'1024'}]};
 const channels=Array.from({length:31},(_,i)=>({
  id:String(i+1),name:'historic-'+i,type:0,parent_id:'hold',position:i,
  permission_overwrites:[{id:guild,type:0,allow:'0',deny:'1024'}]
 }));
 return {id:guild,when:'2026-10-17T12:00:00.000Z',channels:[hold,...channels]};
}
function runAudit(snap) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-alias-census-test-'));
 const source=path.join(root,'snapshot.json'),output=path.join(root,'receipt.json');
 try {
  fs.writeFileSync(source,JSON.stringify(snap));
  const p=spawnSync(process.execPath,[script],{
   cwd:root,encoding:'utf8',windowsHide:true,
   env:{...process.env,DISCORD_COUNCIL_SNAPSHOT_PATH:source,DISCORD_COUNCIL_ALIAS_RECEIPT_PATH:output}
  });
  return {status:p.status,stderr:p.stderr,stdout:p.stdout,receipt:fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null};
 } finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('historical alias census requires actual private child overrides and complete 31-channel input',()=>{
 const good=runAudit(snapshot());
 assert.equal(good.status,0,good.stderr);
 assert.equal(good.receipt.channelCount,31);
 assert.ok(good.receipt.entries.every(row=>row.privateChannelVerified));
 const open=snapshot();open.channels[5].permission_overwrites=[];
 const bad=runAudit(open);
 assert.notEqual(bad.status,0,'child without @everyone deny must not be certified private');
 assert.equal(bad.receipt,null,'no receipt after a privacy failure');
 const truncated=snapshot();truncated.channels.pop();
 const short=runAudit(truncated);
 assert.notEqual(short.status,0,'partial archive census must fail closed');
 assert.equal(short.receipt,null);
});


test('historical census cannot overwrite a hardlink or differently cased snapshot path',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-alias-census-alias-'));
 try {
   const source=path.join(root,'snapshot.json');
   const output=path.join(root,'receipt-hardlink.json');
   const original=JSON.stringify(snapshot());
   fs.writeFileSync(source,original);
   fs.linkSync(source,output);
   for(const actualOutput of [output,...(process.platform==='win32'?[source.toUpperCase()]:[])]){
     const p=spawnSync(process.execPath,[script],{
       cwd:root,encoding:'utf8',windowsHide:true,
       env:{...process.env,DISCORD_COUNCIL_SNAPSHOT_PATH:source,DISCORD_COUNCIL_ALIAS_RECEIPT_PATH:actualOutput}
     });
     assert.notEqual(p.status,0,'same file identity must fail closed');
     assert.match(p.stderr,/input and evidence output must be different files/);
     assert.equal(fs.readFileSync(source,'utf8'),original,'original snapshot must remain unchanged');
   }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
