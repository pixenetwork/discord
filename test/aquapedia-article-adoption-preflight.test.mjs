import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {requiredChannelKinds,channelWriteCandidates} from '../tools/aquapedia-article-destination-policy.mjs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');

test('actual publisher filters receipt-only adoptions before privacy destination preflight',()=>{
 assert.match(source,/channelWriteCandidates\(workChanges,cap,state\.pages,announcedCatalogPages\)/);
 assert.match(source,/requiredChannelKinds\(writeCandidates,cap\)/);
});
test('already-verified metadata receipts do not require private-channel write preflight',()=>{
 const url='/shrimpapedia/competitions/verified/';
 const candidates=channelWriteCandidates([url],50,{},new Set([url]));
 assert.deepEqual(candidates,[]);
 assert.deepEqual(requiredChannelKinds(candidates),[]);
});
test('changed already-tracked pages still require destination privacy validation',()=>{
 const url='/shrimpapedia/competitions/verified/';
 const candidates=channelWriteCandidates([url],50,{[url]:{digest:'old'}},new Set([url]));
 assert.deepEqual(candidates,[url]);
 assert.deepEqual(requiredChannelKinds(candidates),['shrimp']);
});
test('unannounced new public article must not silently skip Discord destination check',()=>{
 const url='/medakapedia/strains/new/';
 assert.deepEqual(channelWriteCandidates([url],50,{},new Set()),[url]);
 assert.deepEqual(requiredChannelKinds([url]),['research']);
});
test('the cap applies before filtering adoptions, never pulls later routes into this batch',()=>{
 const adopted=Array.from({length:50},(_,i)=>'/shrimpapedia/verified-'+i+'/');
 const after='/medakapedia/strains/later/';
 const candidates=channelWriteCandidates([...adopted,after],50,{},new Set(adopted));
 assert.deepEqual(candidates,[]);
});
test('tracked section root routes are accepted as privacy destinations',()=>{
 assert.deepEqual(requiredChannelKinds(['/medakapedia/']),['research']);
 assert.deepEqual(requiredChannelKinds(['/shrimpapedia/']),['shrimp']);
 assert.deepEqual(requiredChannelKinds(['/arowanapedia/']),['research']);
});
test('the destination preflight accepts a previously tracked Unicode slug',()=>{
 assert.deepEqual(requiredChannelKinds(['/medakapedia/strains/花菊/']),['research']);
});
test('unsafe or invalid article URLs stay rejected',()=>{
 for(const url of ['/medakapedia/strains/a?x=1/','/other/','/medakapedia/a/../','/medakapedia/strains/no-end']){
  assert.throws(()=>requiredChannelKinds([url]),/Unsupported article route/);
 }
});
