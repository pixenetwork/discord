import test from 'node:test';
import assert from 'node:assert/strict';
import { BREEDING_REPORTS, breedingEvidenceLines } from '../tools/corydoras-breeding-evidence.mjs';
import { catalogFromSource, sourcePacket } from '../tools/corydoras-forum-publisher.mjs';

test('eleven documented breeders or source accounts have real attribution and rights warnings',()=>{
 assert.equal(Object.keys(BREEDING_REPORTS).length,11);
 for(const [name,r] of Object.entries(BREEDING_REPORTS)){
  assert.ok(r.observer.length>10,name+' reporter');
  assert.equal(r.facts.length,3,name+' exact observation count');
  assert.match(r.url,/^https:\/\//,name+' source');
  assert.ok(r.qualifier.length>25,name+' limitations');
  const lines=breedingEvidenceLines(name).join(' ');
  assert.match(lines,/Documented keeper/);
  assert.match(lines,/Evidence limits/);
  assert.match(lines,/do not republish photos\/text/);
 }
});
test('all breeder evidence species exist in exact dated directory and fit Discord post limit',()=>{
 const catalog=catalogFromSource();
 for(const name of Object.keys(BREEDING_REPORTS)){
  const rec=catalog.find(r=>r.name===name);
  assert.ok(rec,name+' must exist in the 528-record directory');
  const packet=sourcePacket(rec);
  assert.ok(packet.content.length<=2000,name+' content length='+packet.content.length);
  assert.match(packet.content,/Original published account/);
  assert.match(packet.content,/Breeder \/ founder/);
  assert.deepEqual(packet.allowedMentions,{parse:[]});
  assert.match(packet.embeds[0].footer.text,/AQP-CORY-/);
 }
});
test('archived reports are single observational cases, not genetically bred new varieties',()=>{
 for(const n of ['Hoplisoma panda','Hoplisoma xinguense','Hoplisoma metae','Hoplisoma weitzmanii']){
  const packet=sourcePacket(catalogFromSource().find(r=>r.name===n)).content;
  assert.match(packet,/not|NOT|unknown|uncontrolled|did not|No /i);
 }
 assert.match(sourcePacket(catalogFromSource().find(r=>r.name==='Hoplisoma weitzmanii')).content,/weitzmani/);
 assert.match(sourcePacket(catalogFromSource().find(r=>r.name==='Hoplisoma xinguense')).content,/certificate/);
 assert.match(sourcePacket(catalogFromSource().find(r=>r.name==='Hoplisoma metae')).content,/uncontrolled hypothesis/);
});
test('independent sterbai keeper accounts disagree on temperatures without creating an optimum',()=>{
 const report=BREEDING_REPORTS['Hoplisoma sterbai'];
 const packet=breedingEvidenceLines('Hoplisoma sterbai').join(' ');
 assert.match(packet,/Don Kinyon/);
 assert.match(packet,/68–74°F/);
 assert.match(packet,/84°F/);
 assert.match(packet,/not a controlled finding/);
 assert.match(packet,/pvas.com\/post\/corydoras-sterbai/);
 assert.ok(report.independentReport);
});
test('non-reviewed species stay unexpanded and no generic parameters are manufactured',()=>{
 const rec=catalogFromSource().find(r=>r.name==='Hoplisoma hypnos');
 assert.equal(breedingEvidenceLines(rec.name).length,0);
 assert.doesNotMatch(sourcePacket(rec).content,/Documented keeper \/ source/);
});
