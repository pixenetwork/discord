import test from 'node:test';
import assert from 'node:assert/strict';
import {records,makePacket,makeGuide} from '../tools/pleco-forum-publisher.mjs';

test('all Plecopedia IDs and thread titles are unique',()=>{
 assert.equal(records.length,146);
 assert.equal(new Set(records.map(r=>r.id)).size,146);
 assert.equal(new Set(records.map(r=>r.title)).size,146);
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
 assert.match(guide.content,/146 standalone research topics/i);
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

test('fifth batch localities and taxonomic uncertainty are explicit',()=>{
 const ids=['l011','l035','l108','l116','l131','l153'];
 assert.deepEqual(ids.map(id=>records.find(r=>r.id===id)?.kind),['Taxonomy','L-number','L-number','L-number','L-number','L-number']);
 for(const id of ids){const r=records.find(x=>x.id===id);assert.match(r.name,/cf\./);assert.ok(r.sources[0].startsWith('https://'))}
});
test('L083 and L165 conflicting gibbiceps identity is not silently merged',()=>{
 const a=records.find(x=>x.id==='l083'),b=records.find(x=>x.id==='l165');
 assert.match(a.name,/cf\./);assert.match(a.fact,/L165/);assert.match(b.name,/gibbiceps/);
});
test('L191 remains a provisional comparison while L418 is named Panaque titan',()=>{
 assert.equal(records.find(x=>x.id==='l191').kind,'L-number');
 assert.match(records.find(x=>x.id==='l191').name,/cf\. titan/);
 assert.equal(records.find(x=>x.id==='l418').kind,'Named species');
});
test('2025 L333 science links the renamed seideli taxon with caution on abstract contradiction',()=>{
 const r=records.find(x=>x.id==='study-l333-captive');
 assert.match(r.fact,/56 fish/);
 assert.match(r.fact,/145 spawns/);
 assert.match(r.breeding,/contradictory/);
 assert.match(r.sources[1],/1982-0224-2024-0080/);
});
test('Peckoltia amjikin diagnosis does not hallucinate official L038 assignment',()=>{
 const r=records.find(x=>x.id==='p-amjikin');
 assert.match(r.fact,/L038 assignment is NOT proven/);
 assert.match(r.sources[0],/jfb\.70235/);
});

test('2025 Trombetas L274 and L384 map to different named species',()=>{
 const a=records.find(x=>x.id==='bary-isaaci'),b=records.find(x=>x.id==='bary-quilombola');
 assert.match(a.name,/Baryancistrus isaaci/);
 assert.match(b.name,/Baryancistrus quilombola/);
 assert.equal(a.kind,'Named species');assert.equal(b.kind,'Named species');
 assert.match(records.find(x=>x.id==='l274-alias').name,/isaaci/);
 assert.match(records.find(x=>x.id==='l384-alias').name,/quilombola/);
 assert.notEqual(a.id,b.id);
});
test('Peckoltia greedoi recorded in Rio Gurupi not Orinoco',()=>{
 const r=records.find(x=>x.id==='peckol-greedoi');
 assert.match(r.area,/Gurupi/);
 assert.doesNotMatch(r.area,/Orinoco/);
});
test('2007 Hypancistrus contradens and lunaorum diagnosis preserves spot-size difference',()=>{
 const a=records.find(x=>x.id==='hyp-contradens');
 const b=records.find(x=>x.id==='hyp-lunaorum');
 assert.equal(a.kind,'Named species');assert.equal(b.kind,'Named species');
 assert.match(a.fact,/larger than nasal opening/);
 assert.match(b.fact,/smaller than nasal aperture/);
 assert.match(a.fact,/L201a/);
});
test('newly described Guyanancistrus are names, not presumed L-number imports',()=>{
 const r=['guyan-nassauensis','guyan-brownsberg','guyan-teretirostris','guyan-tenuis','guyan-megastictus'].map(id=>records.find(x=>x.id===id));
 assert.equal(r.filter(x=>x?.kind==='Named species').length,5);
 assert.equal(new Set(r.map(x=>x.name)).size,5);
 for(const x of r)assert.match(x.sources[0],/0189789/);
});

test('seventh batch correctly resolves L267 Ancistrus yanesha rather than a new artificial strain',()=>{
 const s=records.find(x=>x.id==='anc-yanesha'),a=records.find(x=>x.id==='anc-l267-alias');
 assert.match(s.name,/Ancistrus yanesha/);assert.match(s.fact,/L267/);assert.equal(s.kind,'Named species');
 assert.equal(a.kind,'L-number');assert.match(a.name,/yanesha/);
});
test('new 2025 Tocantins Hypancistrus is parkateje and not an unsubstantiated L code',()=>{
 const r=records.find(x=>x.id==='hyp-parkateje');assert.equal(r.kind,'Named species');
 assert.match(r.name,/parkateje/);assert.match(r.fact,/E-shaped snout/);
 assert.doesNotMatch(r.fact,/L\d{3}/);
});
test('Rio Negro spotted Hypancistrus are not L201 trade code clones',()=>{
 const a=records.find(x=>x.id==='hyp-phantasma'),b=records.find(x=>x.id==='hyp-margaritatus');
 assert.match(a.area,/Uaupés/);assert.match(b.area,/Takutu/);
 assert.equal(a.kind,'Named species');assert.equal(b.kind,'Named species');
});
test('L159 now maps to Ancistrus luzia with documented Tapajos-Xingu range',()=>{
 const r=records.find(x=>x.id==='anc-luzia');
 assert.match(r.title,/L159/);assert.match(r.name,/Ancistrus luzia/);
 assert.match(r.fact,/adipose fin/);
});
test('Panaqolus koko retains original name but records CAS accepted reclassification',()=>{
 const r=records.find(x=>x.id==='pana-koko');
 assert.match(r.name,/Pseudoqolus koko/);
 assert.match(r.fact,/Panaqolus koko/);
 assert.match(r.sources[0],/calacademy/);
});