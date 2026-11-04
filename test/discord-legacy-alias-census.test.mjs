import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const tool=path.join(import.meta.dirname,'..','tools','discord-legacy-alias-census.mjs');
const roots=[];
test.after(()=>{for(const root of roots)fs.rmSync(root,{recursive:true,force:true});});

function makeSnapshot(count=31,{publicIndex=-1}={}){
 const guild='1519337502379475095';
 const hold={id:'hold',type:4,name:'MIGRATION HOLD',permission_overwrites:[{id:guild,type:0,allow:'0',deny:'1024'}]};
 const children=Array.from({length:count},(_,i)=>({
  id:'c'+i,type:0,name:'legacy-'+i,parent_id:'hold',position:i,last_message_id:'m'+i,
  permission_overwrites:i===publicIndex?[]:[{id:guild,type:0,allow:'0',deny:'1024'}]
 }));
 return {when:'2026-10-18T01:23:07.859Z',id:guild,roles:[{id:guild,permissions:'1024'}],channels:[hold,...children]};
}

function run(snapshot){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'discord-census-'));roots.push(root);
 const input=path.join(root,'snapshot.json'),output=path.join(root,'out','inventory.json');
 fs.writeFileSync(input,JSON.stringify(snapshot));
 const child=spawnSync(process.execPath,[tool],{encoding:'utf8',env:{...process.env,AQUAPEDIA_SNAPSHOT_PATH:input,AQUAPEDIA_ALIAS_INVENTORY_PATH:output,AQUAPEDIA_MIGRATION_HOLD_EXPECTED_COUNT:'31'}});
 return {child,output,report:fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null};
}

test('complete private 31-channel census writes only child-verified entries',()=>{
 const {child,report}=run(makeSnapshot());
 assert.equal(child.status,0,child.stderr);
 assert.equal(report.channelCount,31);
 assert.ok(report.entries.every(x=>x.privateChannelVerified===true));
 assert.ok(report.entries.every(x=>!('privateParentVerified' in x)));
});

test('census fails closed when a Migration Hold child is public',()=>{
 const {child,report}=run(makeSnapshot(31,{publicIndex:7}));
 assert.notEqual(child.status,0,'public child must fail');
 assert.equal(report,null);
 assert.match(child.stderr,/child not private/i);
});

test('census fails closed when the expected archive cardinality is incomplete',()=>{
 const {child,report}=run(makeSnapshot(30));
 assert.notEqual(child.status,0,'incomplete census must fail');
 assert.equal(report,null);
 assert.match(child.stderr,/census incomplete/i);
});
