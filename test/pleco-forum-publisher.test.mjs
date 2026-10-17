import test from 'node:test';
import assert from 'node:assert/strict';
import {records,makePacket,makeGuide} from '../tools/pleco-forum-publisher.mjs';

test('all Plecopedia IDs and thread titles are unique',()=>{
 assert.equal(records.length,84);
 assert.equal(new Set(records.map(r=>r.id)).size,84);
 assert.equal(new Set(records.map(r=>r.title)).size,84);
 assert.deepEqual(records.filter(r=>r.name==='Hypancistrus seideli').map(r=>r.id),
  ['l066','l236','l287','l333','l399','l400']);
});
test('forum post packets are bounded, source-backed and not image copies',()=>{
 for(const r of records){
  assert.ok(r.sources.length>=1,r.id);
  assert.ok(r.sources.every(s=>s.startsWith('https://')),r.id);
  const packet=makePacket(r);
  assert.ok(packet.content.length<=2000,r.id);
  assert.equal(packet.allowedMentions.parse.length,0);
  assert.ok(!packet.files&&!packet.embeds.some(e=>e.image),r.id);
  assert.ok(packet.embeds[0].footer.text.startsWith('AQP-PLECO-'+r.id));
  assert.match(packet.content,/research draft/i);
  assert.match(packet.content,/unverified|not established|pending/i);
 }
});
test('L200 names resolve to two different described species',()=>{
 const matched=records.filter(r=>r.id.startsWith('l200-'));
 assert.deepEqual(matched.map(r=>r.name),['Baryancistrus demantoides','Hemiancistrus subviridis']);
 matched.forEach(r=>assert.ok(r.sources.includes('https://doi.org/10.1590/S1679-62252005000400011')));
});
test('Gold Nugget paper citation is its confirmed 2011 original DOI',()=>{
 const r=records.find(x=>x.id==='l018');
 assert.ok(r.sources.includes('https://doi.org/10.1590/S1679-62252011000200001'));
 assert.ok(!r.sources.some(x=>x.endsWith('00012')));
});
test('forum guide distinguishes L-number vs species and warns against copying photos',()=>{
 const guide=makeGuide();
 assert.match(guide.content,/not the complete L-number catalog/i);
 assert.match(guide.content,/84 standalone research topics/i);
 assert.match(guide.content,/No copied\/AI-generated animal photographs/i);
 assert.match(guide.embeds[0].footer.text,/AQP-PLECO-master-index/);
});
test('third batch keeps L024 and L025 species, watersheds and descriptions distinct',()=>{
 const a=records.find(r=>r.id==='l024'),b=records.find(r=>r.id==='l025');
 assert.equal(a.name,'Pseudacanthicus pitanga (Chamon, 2015)');
 assert.match(a.area,/Tocantins/);
 assert.equal(b.name,'Pseudacanthicus pirarara (Chamon & Sousa, 2016)');
 assert.match(b.area,/Xingu/);
 assert.notEqual(a.sources[0],b.sources[0]);
});
test('historical L056 misidentification is flagged and never treated as aurantiacus',()=>{
 const r=records.find(x=>x.id==='l056');
 assert.match(r.fact,/mislabeled|mislabeled|wrong|mislabeled|mislabeled|mislabeled/i);
 assert.match(r.fact,/1855|1995/);
 assert.match(r.sources[0],/ig-bssw/);
 assert.equal(r.kind,'Taxonomy');
});
test('2021 L017 caveat preserves the original identification conflict',()=>{
 const r=records.find(x=>x.id==='l017');
 assert.match(r.fact,/Pseudancistrus/);
 assert.match(r.fact,/asurini/);
 assert.equal(r.kind,'Taxonomy');
});
test('2009 L025 breeder report is attributed, not presented as spawning advice',()=>{
 const r=records.find(x=>x.id==='breeder-christophe-l025');
 assert.match(r.name,/Christophe Girardet/);
 assert.match(r.breeding,/never deliberate|never.*instruction|not/i);
 assert.match(r.sources[0],/article_id=405/);
});
test('L027 variants are separate locality labels, not independent formal species',()=>{
 const codes=['l027','l027x','l027-toc'].map(id=>records.find(r=>r.id===id));
 assert.equal(codes.length,3);
 for(const r of codes)assert.ok(r);
 assert.equal(codes.filter(r=>r.kind==='Named species').length,1);
 assert.deepEqual(codes.map(r=>r.id),['l027','l027x','l027-toc']);
});

test('L397 provisional and L398 named are never swapped',()=>{
 const a=records.find(x=>x.id==='l397'),b=records.find(x=>x.id==='l398');
 assert.match(a.name,/sp\. L397/);
 assert.equal(a.kind,'L-number');
 assert.match(b.name,/Panaqolus tankei/);
 assert.equal(b.kind,'Named species');
 assert.match(b.sources[0],/0165388/);
});
test('L144 historic and modern captive yellow stocks are disambiguated',()=>{
 const a=records.find(x=>x.id==='l144-original'),b=records.find(x=>x.id==='morph-lemon');
 assert.match(a.area,/Paraguay/);
 assert.match(b.fact,/modern|original/i);
 assert.equal(b.kind,'Captive morph');
 assert.match(b.breeding,/F1\/F2/);
});
test('L600 fake trade number and L427 historical regional origin stay separate',()=>{
 const a=records.find(x=>x.id==='l600'),b=records.find(x=>x.id==='l427');
 assert.match(a.fact,/never officially|never.*official/i);
 assert.match(b.area,/Jatapu/);
 assert.equal(b.kind,'L-number');
});
test('L001 and L022; L021 and L023 are aliases, not species multiplication',()=>{
 const keys=['l001','l022','l021','l023'].map(id=>records.find(x=>x.id===id));
 assert.equal(keys.length,4);keys.forEach(x=>assert.ok(x));
 assert.equal(keys.filter(x=>x.kind==='Named species').length,2);
});
test('unlicensed fish images never get embedded and first-breeder certainty is qualified',()=>{
 const r=records.find(x=>x.id==='breeder-andreas-tanke-l398');
 assert.match(r.fact,/probably|qualified|cautious/i);
 for(const record of records.slice(-20)){const pkt=makePacket(record);assert.ok(pkt.content.length<=2000);assert.ok(!pkt.files);assert.deepEqual(pkt.allowedMentions.parse,[]);}
});