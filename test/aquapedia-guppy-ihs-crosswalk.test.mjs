import test from 'node:test';
import assert from 'node:assert/strict';
import {mapIkghGuppyTrait,auditIkghGuppyCohort} from '../src/aquapedia-guppy-ihs-crosswalk.mjs';
import {buildCrossTaxaCoverage} from '../src/aquapedia-cross-taxa-publication-policy.mjs';

const standardNames=[
 'Wild grey','Gold base','Blond base','Blue base','Pink base','Albino (RREA) base','White base','Silver base','Cream base','Lutino (WREA) base',
 'Red cover','Blue cover','Green cover','Yellow cover','White cover','Black cover','Neon','Moscow','Metallic','Half-black',
 'Three-quarter black','Snakeskin','Lace / Filigree','Viennese Emerald','One single color','Two-tone','Multicolor','Mosaic','Galaxy',
 'Japan Blue','Singa Blue','Blue Grass','Red Grass','Santa Maria','Pink Moscow / Panda',
 'Fan Tail','Triangle Tail / Delta','Veil Tail','Flag Tail','Halfmoon Tail','Double Swordtail','Top Swordtail',
 'Bottom Swordtail','Lyre Tail','Spade Tail','Spear Tail','Round Tail','Needle / Pin Tail'
];
const record=(number,name,status='Officially standardized phenotype')=>{const id=String(number).padStart(3,'0');return {group:'guppy',url:'/guppypedia/entries/gup-'+id+'/',slug:'guppy-gup-'+id,type:'Guppy standardized trait',name,status}};
test('IKGH 2023 source clauses map accurately to 10 base, 25 cover/pattern and 13 tail entries',()=>{
 const cohort=standardNames.map((name,i)=>record(i+1,name));
 const a=auditIkghGuppyCohort(cohort);
 assert.deepEqual(a.counts,{base:10,cover:25,tail:13,trade:0});
 assert.equal(a.total,48);
 assert.equal(a.publicationAuthorized,false);
 for(const r of a.records)assert.equal(r.publicationAuthorized,false);
 assert.equal(a.records[0].code,'195');
 assert.equal(a.records[9].code,'203a');
 assert.equal(a.records[10].code,'205.1');
 assert.equal(a.records[19].code,'205.10');
 assert.equal(a.records[20].code,'205.10');
 assert.equal(a.records[34].code,'207');
 assert.equal(a.records[35].code,'A1');
 assert.equal(a.records[39].code,'A5');
 assert.equal(a.records[40].code,'B1');
 assert.equal(a.records[47].code,'C4');
 assert.equal(a.records[0].sourceUrl,'https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf');
});
test('exact evidence names are required, even for recognized number and official status',()=>{
 for(const bad of [
  record(1,'Unidentified'),
  record(35,'Pink Moscow'),
  {...record(7,'White base'),status:'Trade label; lineage unverified'},
  {...record(1,'Wild grey'),url:'/guppypedia/entries/gup-002/'},
 ])assert.throws(()=>mapIkghGuppyTrait(bad),/IKGH crosswalk/);
});
test('published-status trade labels cannot be promoted through this crosswalk',()=>{
 const trade={...record(49,'Moscow Blue','Trade label; lineage unverified'),type:'Guppy documented commercial line'};
 assert.throws(()=>mapIkghGuppyTrait(trade),/IKGH crosswalk/);
});
test('full 176 site records require 48 approved-form labels and preserve 128 held trade records',()=>{
 const cohort=standardNames.map((name,i)=>record(i+1,name));
 const trade=Array.from({length:128},(_,i)=>{
  const n=i+49;
  const type=n<=70?'Guppy documented commercial line':n<=140?'Guppy documented hobby label':
   n<=146?'Guppy documented trade trait':n<=171?'Guppy documented seller label':'Guppy separate-species or hybrid-related label';
  return {...record(n,'Trade '+(i+1),'Trade label; lineage unverified'),type};
 });
 const plan=auditIkghGuppyCohort([...cohort,...trade],{expectFullCohort:true});
 assert.deepEqual(plan.counts,{base:10,cover:25,tail:13,trade:128});
 assert.equal(plan.total,176);
 assert.equal(plan.records.length,48);
 assert.equal(plan.tradeHeld,128);
 assert.equal(plan.publicationAuthorized,false);
 assert.throws(()=>auditIkghGuppyCohort([...cohort,...trade.slice(1)],{expectFullCohort:true}),/IKGH crosswalk/);
 assert.throws(()=>auditIkghGuppyCohort([...cohort,cohort[0]],{}),/IKGH crosswalk/);
});
test('historical Pleco alias reuses one existing thread and never proposes publication',()=>{
 const item={group:'pleco',url:'/plecopedia/research/soromoni-stearleyi/',name:'Pseudolithoxus stearleyi — formerly Soromonichthys',status:'Research draft — independent review pending'};
 const legacy={id:'1561147018473381900',name:'Soromonichthys stearleyi — Guiana Shield specialty'};
 const p=buildCrossTaxaCoverage([item],{pleco:[legacy]},{guildActiveThreads:896});
 assert.equal(p.byGroup.pleco.exactMatches,0);
 assert.equal(p.byGroup.pleco.aliasMatches,1);
 assert.equal(p.byGroup.pleco.unmatched,0);
 assert.deepEqual(p.byGroup.pleco.matchedThreadIds,[legacy.id]);
 assert.equal(p.publicationAuthorized,false);
 assert.throws(()=>buildCrossTaxaCoverage([item],{pleco:[legacy,{id:'45',name:item.name}]},{guildActiveThreads:896}),/Ambiguous Pleco alias/);
});
