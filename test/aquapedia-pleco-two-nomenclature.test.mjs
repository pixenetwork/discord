import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoNomenclatureIndex} from '../src/aquapedia-pleco-two-nomenclature.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('two nomenclature-only links state original/current combos without aquarium pedigrees',()=>{
 const v=buildPlecoNomenclatureIndex(catalog,'hyp-vandragti');
 const p=buildPlecoNomenclatureIndex(catalog,'pana-changae');
 assert.equal(v.threadId,'1561147015482839093');
 assert.equal(p.threadId,'1561174473669873706');
 assert.match(v.content,/2011 original description/);
 assert.match(p.content,/2002/);
 assert.match(p.content,/NOT the original description/);
 for(const x of [v,p]){
  assert.ok(x.content.includes(x.marker));
  assert.ok(x.content.includes(x.originalSource));
  assert.equal(x.attachments,0);
  assert.equal(x.claimsAboutSpecimens,false);
  assert.ok(x.content.length<1450);
 }
});
test('unknown names and promoted or missing sources are refused',()=>{
 assert.throws(()=>buildPlecoNomenclatureIndex(catalog,'other'),/Pleco nomenclature index/);
 assert.throws(()=>buildPlecoNomenclatureIndex(catalog.slice(1),'pana-changae'),/Pleco nomenclature index/);
 assert.throws(()=>buildPlecoNomenclatureIndex(catalog.map(x=>x.slug==='pana-changae'?{...x,status:'published'}:x),'pana-changae'),/Pleco nomenclature index/);
});
