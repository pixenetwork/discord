import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoNamedSourceIndex,PLECO_NAMED_SOURCE_TARGETS} from '../src/aquapedia-pleco-two-named-source.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('only two named-species directory links with exact authentic Catalog of Fishes references',()=>{
 const keys=Object.keys(PLECO_NAMED_SOURCE_TARGETS);
 assert.deepEqual(keys,['anc-claro','pana-nocturnus']);
 const posts=keys.map(key=>buildPlecoNamedSourceIndex(catalog,key));
 assert.equal(new Set(posts.map(x=>x.threadId)).size,2);
 assert.ok(posts.every(x=>x.content.includes(x.catalogUrl)&&x.content.includes(x.marker)));
 assert.ok(posts.every(x=>x.content.includes('not a fish authentication')||x.content.includes('NOT a test of specimen identity')));
 assert.ok(posts.every(x=>x.content.includes('No aquarium fish')&&x.photoCount===0&&x.claimsVerified===false));
 assert.equal(posts[1].originalName,'Panaque nocturnus');
});
test('no accidental name ambiguity, missing cohort or publication-status promotion is accepted',()=>{
 assert.throws(()=>buildPlecoNamedSourceIndex(catalog,'pana-koko'),/Pleco named-source directory/);
 assert.throws(()=>buildPlecoNamedSourceIndex(catalog.slice(1),'anc-claro'),/Pleco named-source directory/);
 assert.throws(()=>buildPlecoNamedSourceIndex(catalog.map(x=>x.slug==='anc-claro'?{...x,status:'verified'}:x),'anc-claro'),/Pleco named-source directory/);
});
