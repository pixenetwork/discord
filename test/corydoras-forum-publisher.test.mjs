import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  catalogFromSource, priorityRecords, sourcePacket, morphPacket,
  guidePacket, PRIORITY_NAMES, TAGS, MORPHS
} from '../tools/corydoras-forum-publisher.mjs';

function syntheticDirectory() {
  // Synthetic records only for parser tests; NOT a biological dataset.
  const rows=[];
  const source=id=>'https://www.corydorasworld.com/lineages/fish/'+id;
  for(let i=1;i<=219;i++){
    const name=i===1?'Hoplisoma sterbai':'Hoplisoma fixture-species-'+i;
    rows.push('| hoplisoma | Named taxon | '+name+' | [CW source]('+source(i)+') |');
  }
  for(let i=1;i<=112;i++){
    const id=219+i;
    rows.push('| corydoras | C-coded | Corydoras sp. C'+String(i).padStart(3,'0')+' | [CW source]('+source(id)+') |');
  }
  for(let i=1;i<=197;i++){
    const id=331+i;
    const code = i===1?'CW009':i===2?'CW023':'CW'+String(i+20).padStart(3,'0');
    rows.push('| osteogaster | CW-coded | Osteogaster sp. '+code+' | [CW source]('+source(id)+') |');
  }
  return rows.join('\n');
}
const fixtureCatalog=catalogFromSource(syntheticDirectory());
test('catalog parser accepts 528 unique labels in three distinct source classifications',()=>{
 assert.equal(fixtureCatalog.length,528);
 assert.equal(new Set(fixtureCatalog.map(x=>x.id)).size,528);
 assert.equal(fixtureCatalog.filter(x=>x.kind==='Named taxon').length,219);
 assert.equal(fixtureCatalog.filter(x=>x.kind==='C-coded').length,112);
 assert.equal(fixtureCatalog.filter(x=>x.kind==='CW-coded').length,197);
 for(const r of fixtureCatalog)assert.match(r.source,/^https:\/\/www\.corydorasworld\.com\/lineages\/fish\/\d+$/);
});
test('parser fails closed on a truncated or duplicate catalog',()=>{
 assert.throws(()=>catalogFromSource(syntheticDirectory().split('\n').slice(1).join('\n')),/Expected 528/);
 const rows=syntheticDirectory().split('\n');
 rows[1]=rows[0];
 assert.throws(()=>catalogFromSource(rows.join('\n')),/Duplicate source record ID/);
});
test('priority records do not invent names absent from source',()=>{
 const {matches,missing}=priorityRecords(fixtureCatalog);
 assert.equal(matches.length+missing.length,PRIORITY_NAMES.length);
 assert.equal(new Set(matches.map(x=>x.id)).size,matches.length);
 assert.ok(matches.some(x=>x.name==='Hoplisoma sterbai'));
 assert.ok(matches.some(x=>x.name==='Osteogaster sp. CW023'));
});
test('coded source post retains source and a research disclaimer with no unlicensed media',()=>{
 const r=fixtureCatalog.find(x=>x.name==='Osteogaster sp. CW009');
 const packet=sourcePacket(r);
 assert.match(packet.content,/NOT necessarily a different species or domestic strain/);
 assert.match(packet.content,/Breeder \/ founder:\*\* Not established/);
 assert.ok(packet.content.includes(r.source));
 assert.equal(packet.files,undefined);
 assert.deepEqual(packet.allowedMentions,{parse:[]});
 assert.match(packet.embeds[0].footer.text,/AQP-CORY-\d+/);
});
test('each captive strain is distinct from the original named or numbered fish',()=>{
 assert.equal(MORPHS.length,8);
 for(const r of MORPHS){
   const packet=morphPacket(r);
   assert.match(packet.content,/not automatically a scientific species/);
   assert.ok(packet.content.includes('**Underlying fish:**'));
   assert.ok(packet.content.includes('**Sources:** https://'));
   assert.deepEqual(packet.allowedMentions,{parse:[]});
 }
});
test('master index provides 528 listings as a CSV with honest limitations',()=>{
 const packet=guidePacket(fixtureCatalog);
 assert.match(packet.content,/not\*\* 528 confirmed species or domestic strains/);
 assert.equal(packet.files.length,1);
 assert.equal(TAGS.length,new Set(TAGS).size);
 assert.ok(TAGS.length<=20);
 assert.deepEqual(packet.allowedMentions,{parse:[]});
});
// Source integration runs on the Main PC only. It is optional in portable unit tests;
// actual publication ALWAYS requires the pinned Aquapedia Git source, not a fixture.
const sourceWorktree=process.env.AQUAPEDIA_WORKTREE||path.join(os.homedir(),'Aquapedia-Release-20261014');
test('actual pinned Aquapedia index has 528 source records when checkout is present',{skip:!fs.existsSync(sourceWorktree)},()=>{
 const records=catalogFromSource();
 assert.equal(records.length,528);
 assert.equal(records.filter(r=>r.kind==='Named taxon').length,219);
 assert.equal(records.filter(r=>r.kind==='C-coded').length,112);
 assert.equal(records.filter(r=>r.kind==='CW-coded').length,197);
});
