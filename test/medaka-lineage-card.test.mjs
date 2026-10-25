import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLineageCard, cardSlug} from '../src/medaka-lineage-card.mjs';
const e={
 slug:'akari',name:'Akari',site_url:'https://aquapedia.app/medakapedia/strains/akari/',
 evidence_state:'breeder_or_publication_reported',parents_or_stages:['Miyuki breeder population','Kinagashi selected descendants'],
 source_title:'Medaka WEB Zukan No.0242',source_url:'https://medakazukan.net/0242_akari/',
 claim_limits:'Reported stages, not DNA-verified parent pair.'
};
const opts={fileName:'aquapedia-medaka-akari-picture-gene-tree.png', forumUrl:'https://discord.com/channels/1519337502379475095/1561210349406126220',revision:'8f8408200ead'};
test('renders one image-led embed with source, confidence, and working action links',()=>{
 const p=buildLineageCard(e,opts);
 assert.equal(p.embeds.length,1);
 assert.equal(p.embeds[0].image.url,'attachment://aquapedia-medaka-akari-picture-gene-tree.png');
 assert.match(p.embeds[0].title,/Akari/);
 assert.match(p.embeds[0].fields.map(x=>x.value).join(' '),/Reported stages, not DNA-verified/);
 assert.match(p.embeds[0].fields.map(x=>x.value).join(' '),/medakazukan.net/);
 assert.equal(p.components[0].components.length,3);
 assert.equal(p.components[0].components[1].url,e.source_url);
 assert.equal(cardSlug({embeds:[{footer:p.embeds[0].footer}]}),'akari');
 assert.ok(p.content.length<100);
});
test('unknown history does not imply verified parentage or invent source',()=>{
 const p=buildLineageCard({...e,slug:'x-test',name:'Unknown',parents_or_stages:[],evidence_state:'parentage_undocumented',source_url:null,source_title:'Aquapedia record without original lineage evidence'},opts);
 assert.match(p.embeds[0].description,/Parent lines not documented/);
 assert.equal(p.components[0].components.length,2);
 assert.equal(p.embeds[0].fields.some(x=>x.value.includes('medakazukan')),false);
 assert.equal(cardSlug({embeds:p.embeds}), 'x-test');
});
test('card slug works on old posts and rejects unrelated messages',()=>{
 assert.equal(cardSlug({content:'[AQUAPEDIA-MEDAKA-LINEAGE-V2:akari]'}),'akari');
 assert.equal(cardSlug({content:'unrelated'}),null);
});
