import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  catalogFromSource, priorityRecords, nextCatalogBatch, sourcePacket, morphPacket, refreshRecord,
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
    const code = i===1?'CW009':i===2?'CW023':'CW'+String(i+200).padStart(3,'0');
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
test('next catalog batch skips already published posts and covers named plus C/CW classes',()=>{
 const occupied=new Set(['Hoplisoma sterbai','Osteogaster sp. CW009']);
 const selection=nextCatalogBatch(fixtureCatalog,occupied,45);
 assert.equal(selection.length,45);
 assert.equal(new Set(selection.map(x=>x.name)).size,45);
 assert.ok(selection.some(x=>x.kind==='Named taxon'));
 assert.ok(selection.some(x=>x.kind==='C-coded'));
 assert.ok(selection.some(x=>x.kind==='CW-coded'));
 assert.ok(!selection.some(x=>occupied.has(x.name)));
 assert.ok(!nextCatalogBatch(fixtureCatalog, new Set(fixtureCatalog.map(x=>x.name)),20).length);
 assert.throws(()=>nextCatalogBatch(fixtureCatalog,new Set(),100),/must be 1 to 80/);
});
test('repeated batches advance deterministically without duplicates',()=>{
 const first=nextCatalogBatch(fixtureCatalog,new Set(),65);
 const second=nextCatalogBatch(fixtureCatalog,new Set(first.map(x=>x.name)),65);
 assert.equal(second.length,65);
 assert.equal(new Set([...first,...second].map(x=>x.name)).size,130);
 assert.deepEqual(nextCatalogBatch(fixtureCatalog,new Set(),65),first);
});
test('priority records do not invent names absent from source',()=>{
 const {matches,missing}=priorityRecords(fixtureCatalog);
 assert.equal(matches.length+missing.length,PRIORITY_NAMES.length);
 assert.equal(new Set(matches.map(x=>x.id)).size,matches.length);
 assert.ok(matches.some(x=>x.name==='Hoplisoma sterbai'));
 assert.ok(matches.some(x=>x.name==='Osteogaster sp. CW023'));
});
test('CW005 post reconciles the historic number with a formally named species',()=>{
  const rec={id:'499',group:'corydoras',kind:'CW-coded',name:'Corydoras sp. CW005',source:'https://www.corydorasworld.com/lineages/fish/499'};
  const packet=sourcePacket(rec);
  assert.match(packet.content,/same species|historical aquarium code/i);
  assert.match(packet.content,/Corydoras aurofrenatus/);
  assert.match(packet.content,/scotcat.com\/callichthyidae\/c_aurofrenatus/);
});
test('taxonomically contested names receive taxonomy review tags, never an unqualified named-species tag',async()=>{
 const rec={id:'484',group:'osteogaster',kind:'Named taxon',name:'Osteogaster venezuelanus',source:'https://www.corydorasworld.com/lineages/fish/484'};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aq-cory-tags-'));
 try{
   const receipt=path.join(dir,'revisions.jsonl');
   const p=sourcePacket(rec);
   const starter={id:'starter',author:{id:'bot'},embeds:p.embeds,content:p.content,edit:async()=>{throw Error('No content edit expected')}};
   let appliedTags=['named','review'];
   const thread={
     id:'thread',get appliedTags(){return appliedTags;},
     fetchStarterMessage:async()=>starter,
     messages:{fetch:async()=>starter},
     async setAppliedTags(ids){appliedTags=ids;},
     async fetch(force){assert.equal(force,true);return {appliedTags};}
   };
   const forum={id:'forum',guild:{id:'guild'},availableTags:[{name:'Taxonomy',id:'taxonomy'},{name:'Needs review',id:'review'}]};
   const map=new Map([[rec.name,thread]]);
   const result=await refreshRecord(forum,map,rec,'bot',receipt);
   assert.equal(result.action,'retagged');
   assert.deepEqual(appliedTags,['taxonomy','review']);
   const repeat=await refreshRecord(forum,map,rec,'bot',receipt);
   assert.equal(repeat.action,'unchanged');
   assert.equal(fs.readFileSync(receipt,'utf8').trim().split('\n').length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('bot-owned forum starter corrections are read back and saved once',async()=>{
  const rec={id:'499',group:'corydoras',kind:'CW-coded',name:'Corydoras sp. CW005',source:'https://www.corydorasworld.com/lineages/fish/499'};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aq-cory-test-'));
  try {
    const receipt=path.join(dir,'receipts.jsonl');
    const message={
      id:'starter',author:{id:'bot'},embeds:[{footer:{text:'AQP-CORY-499 • research draft'}}],
      content:'Previously incomplete overview',
      async edit(payload){this.content=payload.content;this.embeds=payload.embeds;}
    };
    const thread={id:'thread',fetchStarterMessage:async()=>message,messages:{fetch:async()=>message}};
    const forum={id:'forum',guild:{id:'guild'}};
    const map=new Map([[rec.name,thread]]);
    const changed=await refreshRecord(forum,map,rec,'bot',receipt);
    assert.equal(changed.action,'updated');
    assert.equal(fs.readFileSync(receipt,'utf8').trim().split('\n').length,1);
    const identical=await refreshRecord(forum,map,rec,'bot',receipt);
    assert.equal(identical.action,'unchanged');
    assert.equal(fs.readFileSync(receipt,'utf8').trim().split('\n').length,1);
    await assert.rejects(refreshRecord(forum,map,rec,'other-bot',receipt),/ownership\/marker mismatch/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('ambiguous named and suspect source spelling display explicit naming cautions',()=>{
  const suspectName=sourcePacket({id:'529',group:'brochis-sub-clade-1',kind:'Named taxon',name:'Brochis Taiosh',source:'https://www.corydorasworld.com/lineages/fish/529'});
  assert.match(suspectName.content,/Unverified directory name/);
  assert.match(suspectName.content,/not a validated Latin binomial/);
  const suspectSpelling=sourcePacket({id:'520',group:'osteogaster',kind:'CW-coded',name:'Osteogasters sp. CW026',source:'https://www.corydorasworld.com/lineages/fish/520'});
  assert.match(suspectSpelling.content,/genus spelling inconsistency/);
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
test('source-backed named descriptions contain traceable taxonomic and locality evidence',{skip:!fs.existsSync(sourceWorktree)},()=>{
 const actual=catalogFromSource();
 for(const name of ['Corydoras aurofrenatus','Osteogaster oharai','Osteogaster venezuelanus','Osteogaster schultzei']){
   const rec=actual.find(x=>x.name===name);
   assert.ok(rec, 'The pinned source directory must contain '+name);
   const post=sourcePacket(rec);
   assert.ok(post.content.length<=2000, name+' must fit a Discord post');
   assert.deepEqual(post.allowedMentions,{parse:[]});
   assert.match(post.content,/https:\/\//);
   assert.match(post.content,/Research draft \/ verification pending/);
 }
 const oharai=sourcePacket(actual.find(x=>x.name==='Osteogaster oharai'));
 assert.match(oharai.content,/CW068/);
 assert.match(oharai.content,/Aripuanã/);
 assert.match(oharai.content,/Juruena/);
 assert.match(oharai.content,/2025/);
 assert.match(oharai.content,/original captive-line breeder|No named original captive-line breeder/);
 const venezuelanus=sourcePacket(actual.find(x=>x.name==='Osteogaster venezuelanus'));
 assert.match(venezuelanus.content,/Contested taxonomic status/);
 assert.match(venezuelanus.content,/synonym of Osteogaster aenea/);
 assert.match(venezuelanus.content,/NOT the captive-selected Black Venezuela/);
 const schultzei=sourcePacket(actual.find(x=>x.name==='Osteogaster schultzei'));
 assert.match(schultzei.content,/Contested taxonomic status/);
 assert.match(schultzei.content,/uncertain/);
 const aurofrenatus=sourcePacket(actual.find(x=>x.name==='Corydoras aurofrenatus'));
 assert.match(aurofrenatus.content,/CW005/);
 assert.match(aurofrenatus.content,/Arroyo Trementina/);
});
test('actual pinned Aquapedia index has 528 source records when checkout is present',{skip:!fs.existsSync(sourceWorktree)},()=>{
 const records=catalogFromSource();
 assert.equal(records.length,528);
 assert.equal(records.filter(r=>r.kind==='Named taxon').length,219);
 assert.equal(records.filter(r=>r.kind==='C-coded').length,112);
 assert.equal(records.filter(r=>r.kind==='CW-coded').length,197);
});
