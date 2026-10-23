import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefinition } from '../src/layout.mjs';

test('Corydoraspedia community is a single public category between Medaka and Shrimp', () => {
  const sections=layoutDefinition();
  const names=sections.map(x=>x.category);
  const idx=names.indexOf('🐟・CORYDORASPEDIA');
  assert.ok(idx>=0);
  assert.equal(names.indexOf('🐟・MEDAKA & FISH')+1,idx);
  assert.equal(names.indexOf('🦐・SHRIMP'),idx+1);
  assert.equal(names.filter(x=>x==='🐟・CORYDORASPEDIA').length,1);
  const section=sections[idx];
  assert.notEqual(section.vendorOnly,true);
  assert.notEqual(section.staffOnly,true);
  assert.equal(section.forums?.length??0,0,'Do not duplicate the existing Corydoras research forum');
  const expected=[
    '💬・corydoras-discussion',
    '🥚・corydoras-breeding',
    '🧬・corydoras-traits',
    '🩺・corydoras-care',
    '📸・corydoras-showcase'
  ];
  assert.deepEqual(section.channels.map(([name])=>name),expected);
  for(const [name,topic] of section.channels){
    assert.ok(topic.length>=70, name+' needs a substantive topic');
    assert.match(topic,/Corydor|species|research|science|pedigree|genetic|photo|breeding|egg/i);
  }
});

test('Aquapedia public research assistance channels have unique names', () => {
  const sections=layoutDefinition();
  const pub=sections.find(x=>x.category==='📚・AQUAPEDIA');
  assert.ok(pub);
  assert.equal(pub.staffOnly,undefined);
  assert.equal(pub.vendorOnly,undefined);
  const names=pub.channels.map(([name])=>name);
  for(const name of ['🐟・corydoras-guides','🔎・research-requests','📖・sources-and-credits']){
    assert.equal(names.filter(x=>x===name).length,1);
  }
  assert.match(pub.channels.find(([name])=>name==='🐟・corydoras-guides')[1],/Species & Genetics/);
  const all=sections.flatMap(s=>s.channels.map(([name])=>name));
  assert.equal(new Set(all).size,all.length,'Public text channel names must remain unique');
});

test('Corydoras forum remains a separate source-backed archive, not cloned under community', () => {
  const sections=layoutDefinition();
  const cory=sections.find(s=>s.category==='🐟・CORYDORASPEDIA');
  assert.deepEqual(cory.forums??[],[]);
  assert.equal(cory.channels.some(([name])=>name.includes('corydoras-research')),false);
});
