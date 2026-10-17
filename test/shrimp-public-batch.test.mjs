import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareShrimpPublicBatch } from '../src/shrimp-public-batch.mjs';

const breeders = Array.from({length:14},(_,i)=>({
  id: 'breeder-'+i, name:'Breeder '+i, entityType:'breeder',organismGroup:'shrimp',
  sources:['https://aquapedia.app/shrimpapedia/breeders/example-'+i+'/'],
  photos:[],summary:'Provisional breeder line '+i
}));
const contests = Array.from({length:8},(_,i)=>({
  id:'competition-'+i,kind:'competition',title:'Competition '+i,
  message:'Verified historical edition '+i+'; original strain creator not inferred.',
  links:['https://aquapedia.app/shrimpapedia/competitions/example-'+i+'/']
}));
const breederManifest={status:'pending_review',discordPublicationApproved:false,cards:breeders};
const contestManifest={publication_status:'NOT_POSTED',records:[
  ...breeders.slice(0,4).map(x=>({id:x.id,kind:'breeder',title:x.name,message:'Already included'})),
  ...contests
]};

test('adapter compiles exactly 14 distinct breeders and 8 contests without double-posting four highlight breeders',()=>{
  const result=prepareShrimpPublicBatch({breederManifest,contestManifest});
  assert.equal(result.cards.length,22);
  assert.equal(result.cards.filter(x=>x.entityType==='breeder').length,14);
  assert.equal(result.cards.filter(x=>x.entityType==='competition').length,8);
  assert.equal(new Set(result.cards.map(x=>x.id)).size,22);
  assert.deepEqual(result.cards.find(x=>x.id==='competition-0').sources,contests[0].links);
  assert.equal(result.status,'review_pending');
  assert.equal(result.discordPublicationApproved,false);
  assert.equal(result.publicAudienceApproved,false);
  assert.equal(result.publicShrimpResearch,true);
  assert.equal(breederManifest.discordPublicationApproved,false,'source remains untouched');
  assert.equal(contestManifest.publication_status,'NOT_POSTED','source remains untouched');
});

test('explicit editorial AND public-audience approval together may prepare publication; either alone cannot',()=>{
  for(const editorialApproved of [false,true])for(const publicAudienceApproved of [false,true]){
    const r=prepareShrimpPublicBatch({breederManifest,contestManifest,editorialApproved,publicAudienceApproved});
    assert.equal(r.discordPublicationApproved,editorialApproved && publicAudienceApproved);
    assert.equal(r.publicAudienceApproved,editorialApproved && publicAudienceApproved);
    assert.equal(r.status,editorialApproved && publicAudienceApproved?'completed':'review_pending');
  }
});

test('adapter refuses unlicensed images, duplicate IDs and missing competition source URLs',()=>{
  assert.throws(()=>prepareShrimpPublicBatch({breederManifest:{...breederManifest,cards:[{...breeders[0],photos:[{url:'https://example.org/unlicensed.jpg'}]},...breeders.slice(1)]},contestManifest}),/photo/i);
  assert.throws(()=>prepareShrimpPublicBatch({breederManifest:{...breederManifest,cards:[breeders[0],breeders[0],...breeders.slice(2)]},contestManifest}),/duplicate/i);
  assert.throws(()=>prepareShrimpPublicBatch({breederManifest,contestManifest:{...contestManifest,records:[...contestManifest.records.slice(0,-1),{...contests[7],links:[]}]}}),/source/i);
});

test('public source validation rejects private and literal-IP hosts', () => {
  for (const host of ['10.1.2.3', '172.16.2.3', '192.168.1.2', '169.254.1.3', '127.0.0.2', '[::1]']) {
    const clone = { ...breederManifest, cards: [
      { ...breeders[0], sources: ['https://' + host + '/private'] },
      ...breeders.slice(1),
    ] };
    assert.throws(() => prepareShrimpPublicBatch({ breederManifest: clone, contestManifest }), /source/i);
  }
});

test('batch refuses IDs which become indistinguishable in Discord receipt footers',()=>{
  const long='a'.repeat(70);
  const entries=[{...breeders[0], id:long+'A'}, {...breeders[1],id:long+'B'}, ...breeders.slice(2)];
  assert.throws(()=>prepareShrimpPublicBatch({breederManifest:{...breederManifest,cards:entries},contestManifest}),/ID|identity|70/i);
});
