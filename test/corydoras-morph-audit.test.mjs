import test from 'node:test';
import assert from 'node:assert/strict';
import { MORPHS, morphPacket } from '../tools/corydoras-forum-publisher.mjs';
import { MORPH_AUDITS, morphAuditLines } from '../tools/corydoras-morph-audit.mjs';

test('eight verified historical morph records have distinct original source IDs and explicit uncertainties',()=>{
 assert.equal(MORPHS.length,8);
 assert.equal(Object.keys(MORPH_AUDITS).length,8);
 assert.equal(new Set(MORPHS.map(x=>x.id)).size,8);
 for(const rec of MORPHS){
  const audit=MORPH_AUDITS[rec.id];
  assert.ok(audit,rec.id);
  assert.ok(audit.sourceLevel && audit.genetics && audit.sources.length);
  const m=morphPacket(rec);
  assert.ok(m.content.length<=2000,rec.id+' exceeds Discord: '+m.content.length);
  assert.match(m.content,/Genetic evidence gap/);
  assert.match(m.content,/Sources:/);
  assert.deepEqual(m.allowedMentions,{parse:[]});
  assert.match(m.embeds[0].footer.text,new RegExp('AQP-CORY-'+rec.id));
 }
});
test('Black Venezuela historical origin is German selected schultzei-type not assumed Venezuela',()=>{
 const text=morphAuditLines('morph-black-venezuela').join(' ');
 assert.match(text,/Hartmut Eberhardt/);
 assert.match(text,/1996/);
 assert.match(text,/1986/);
 assert.match(text,/disputed/);
 assert.match(text,/2nd/);
});
test('laser morphology forms do not collapse CW009 CW010 CW023 and CW014 into a single genotype',()=>{
 const a=morphAuditLines('morph-blue-laser').join(' ');
 const b=morphAuditLines('morph-red-laser').join(' ');
 const c=morphAuditLines('morph-albino-gold-laser').join(' ');
 assert.match(a,/CW009/);
 assert.match(b,/CW023/);
 assert.match(b,/F2/);
 assert.match(b,/CW014/);
 assert.match(c,/CW010/);
 for(const t of [a,b,c])assert.match(t,/unknown|unverified|not published|not confirmed|incomplete|not a/);
});
test('albino Bronze peer-reviewed study does not prove an allele or a Mendelian ratio',()=>{
 const s=morphAuditLines('morph-albino-bronze').join(' ');
 assert.match(s,/288/);
 assert.match(s,/3:1/);
 assert.match(s,/not/);
});
test('morph audits do not manufacture original breeder IDs or ratios',()=>{
 for(const id of ['morph-longfin-sterbai','morph-longfin-bronze','morph-albino-sterbai']){
  const s=morphAuditLines(id).join(' ');
  assert.match(s,/unverified|not a|no accepted|cannot|no species-specific/i);
 }
});
