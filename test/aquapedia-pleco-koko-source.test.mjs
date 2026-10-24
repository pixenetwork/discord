import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KOKO_SOURCE_PLAN,buildPlecoKokoIndex} from '../src/aquapedia-pleco-koko-source.mjs';
const c=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('koko source plan documents 2012 original, 2017 new genus, explicitly hypothetical introgression',()=>{
 const p=buildPlecoKokoIndex(c);
 assert.equal(p.threadId,'1561147053097230420');
 assert.equal(p.originalName,'Panaqolus koko');
 assert.equal(p.acceptedName,'Pseudoqolus koko');
 assert.match(p.content,/Genetic hypothesis \(not pedigree\)/);
 assert.match(p.content,/not authenticate any aquarium specimen/);
 assert.match(p.content,/NOT established/);
 assert.equal(p.specimenVerified,false);
 assert.equal(p.breedLineageVerified,false);
 assert.equal(p.photos,0);
 assert.ok(p.content.includes(KOKO_SOURCE_PLAN.catalogUrl));
 assert.ok(p.content.includes(KOKO_SOURCE_PLAN.phylogenyDoi));
});
test('koko plan fails closed for missing source, changed status, or alias mutation',()=>{
 assert.throws(()=>buildPlecoKokoIndex(c.slice(1)),/Pleco koko source/);
 assert.throws(()=>buildPlecoKokoIndex(c.map(x=>x.slug==='pana-koko'?{...x,status:'verified'}:x)),/Pleco koko source/);
 assert.throws(()=>buildPlecoKokoIndex(c.map(x=>x.slug==='pana-koko'?{...x,url:'/plecopedia/research/else/'}:x)),/Pleco koko source/);
});
