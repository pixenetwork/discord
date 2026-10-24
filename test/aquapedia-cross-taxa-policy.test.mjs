import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCrossTaxaRecord,buildCrossTaxaCoverage} from '../src/aquapedia-cross-taxa-publication-policy.mjs';

const guppy=(id,status='Officially standardized phenotype')=>({group:'guppy',url:'/guppypedia/entries/gup-'+id+'/',name:'Guppy '+id,slug:'guppy-gup-'+id,type:'Guppy standardized trait',status});
const pleco=(name='L046 — Zebra Pleco')=>({group:'pleco',url:'/plecopedia/research/l046/',name,status:'Research draft — independent review pending'});
const cory=()=>({group:'corydoras',url:'/corydoraspedia/lineages/#black-venezuela',name:'Black Venezuela',status:'Pedigree or genetics under review'});

test('guppy standardized trait requires editorial review before publication; commercial label stays held',()=>{
 assert.deepEqual(classifyCrossTaxaRecord(guppy('001')),{group:'guppy',kind:'article',decision:'review_required'});
 assert.deepEqual(classifyCrossTaxaRecord(guppy('050','Trade label; lineage unverified')),{group:'guppy',kind:'article',decision:'hold_unverified_trade'});
});
test('pleco draft and Corydoras anchored lineage cannot be auto-published as a new page',()=>{
 assert.deepEqual(classifyCrossTaxaRecord(pleco()),{group:'pleco',kind:'article',decision:'hold_draft'});
 assert.deepEqual(classifyCrossTaxaRecord(cory()),{group:'corydoras',kind:'anchor',decision:'hold_anchor'});
});
test('malformed or changed source routes/status fail closed',()=>{
 for(const invalid of [
  {...guppy('001'),url:'/medakapedia/strains/gup-001/'},
  {...guppy('001'),url:'/guppypedia/entries/gup-001/../../'},
  {...guppy('001'),status:'Published and verified'},
  {...pleco(),status:'Published and verified'},
  {...cory(),url:'/corydoraspedia/lineages/black-venezuela/'},
  {...cory(),status:'Genetically confirmed'}
 ])assert.throws(()=>classifyCrossTaxaRecord(invalid),/Untrusted cross-taxa/);
});
test('coverage reuses unique existing titles and keeps all publication changes blocked',()=>{
 const catalog=[guppy('001'),pleco(),cory()];
 const threads={guppy:[{id:'11',name:'Guppypedia — Care and Water'}],pleco:[{id:'22',name:'L046 — Zebra Pleco'}],corydoras:[{id:'33',name:'Black Venezuela'}]};
 const plan=buildCrossTaxaCoverage(catalog,threads,{guildActiveThreads:896});
 assert.equal(plan.total,3);
 assert.equal(plan.byGroup.pleco.exactMatches,1);
 assert.equal(plan.byGroup.corydoras.exactMatches,1);
 assert.equal(plan.byGroup.guppy.exactMatches,0);
 assert.equal(plan.newThreadsToCreate,0);
 assert.equal(plan.publicationAuthorized,false);
 assert.equal(plan.guildThreadCapacitySafe,true);
 assert.equal(plan.byGroup.guppy.pendingReview,1);
});
test('duplicate forum title and invalid thread ids reject the audit, preventing accidental double-post',()=>{
 const catalog=[pleco()];
 assert.throws(()=>buildCrossTaxaCoverage(catalog,{pleco:[{id:'22',name:'L046 — Zebra Pleco'},{id:'23',name:'L046 — Zebra Pleco'}]},{guildActiveThreads:896}),/Duplicate forum title/);
 assert.throws(()=>buildCrossTaxaCoverage(catalog,{pleco:[{id:'',name:'L046 — Zebra Pleco'}]},{guildActiveThreads:896}),/Untrusted thread/);
});
test('strict full-cohort checks prevent silent source drops',()=>{
 const rows=[guppy('001'),pleco(),cory()];
 assert.throws(()=>buildCrossTaxaCoverage(rows,{}, {expectedCounts:{guppy:176,pleco:167,corydoras:19},guildActiveThreads:896}),/Cohort count/);
 assert.equal(buildCrossTaxaCoverage(rows,{}, {guildActiveThreads:950}).guildThreadCapacitySafe,false);
});
