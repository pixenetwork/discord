import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertTrackedRouteCoverage} from '../tools/aquapedia-article-route-integrity.mjs';

const publisher=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const routes=Array.from({length:526},(_,i)=>'/medakapedia/strains/verified-'+i+'/');
const pages=Object.fromEntries(routes.map(route=>[route,{digest:'sha256-old'}]));

test('article publisher validates tracked route coverage before considering changes',()=>{
 assert.match(publisher,/assertTrackedRouteCoverage\(paths,state\.pages\)/);
});
test('complete 526-route inventory is accepted',()=>{
 assert.doesNotThrow(()=>assertTrackedRouteCoverage(routes,pages));
});
test('partial inventory of 376 routes fails even though old 200-route floor passes',()=>{
 const lost=routes.slice(150);
 assert.equal(lost.length,376);
 assert.throws(()=>assertTrackedRouteCoverage(lost,pages),/150.*tracked.*missing|tracked.*missing.*150/i);
});
test('one vanished previously tracked article route is not silently omitted',()=>{
 assert.throws(()=>assertTrackedRouteCoverage(routes.slice(0,-1),pages),/tracked.*missing/i);
});
test('additional routes are allowed without losing previously tracked pages',()=>{
 assert.doesNotThrow(()=>assertTrackedRouteCoverage([...routes,'/medakapedia/strains/new/'],pages));
});
test('reject malformed route lists or checkpoint page maps before publishing',()=>{
 assert.throws(()=>assertTrackedRouteCoverage(null,pages),/invalid/i);
 assert.throws(()=>assertTrackedRouteCoverage(routes,null),/invalid/i);
});
