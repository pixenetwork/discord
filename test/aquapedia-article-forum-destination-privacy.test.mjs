import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('const dest=url=>{');
const end=src.indexOf('  let lock;',start);
assert.ok(start>=0&&end>start,'Locate actual forum destination routing code');
const mk=new Function('catUrlToEntry','threads','breederForums','cleanName','privateDestination','shrimps','results',src.slice(start,end)+'return dest;');
const route='/medakapedia/strains/rinkou/';
const entries=new Map([[route,{name:'Rinkou',group:'medaka'}]]);
const forums=[{id:'forum-private',name:'breeder-stock-forum',parent_id:'breeder-category'}];
const threads=[{id:'strain-thread',name:'Rinkou',parent_id:'forum-private'}];
const cleanName=x=>String(x).replace(/[^a-z0-9]/gi,'').toLowerCase();
const shrimps={id:'shrimp-guides'};
const results={id:'research-results'};
test('thread destination checks parent forum privacy before returning it',()=>{
 let checked=0;
 const dest=mk(entries,threads,forums,cleanName,c=>{checked++;assert.equal(c.id,'forum-private')},shrimps,results);
 assert.equal(dest(route),'strain-thread');
 assert.equal(checked,1);
});
test('publicly overridden breeder forum rejects private article destination',()=>{
 const dest=mk(entries,threads,forums,cleanName,c=>{throw Error('PRIVACY_BLOCK breeder forum '+c.id)},shrimps,results);
 assert.throws(()=>dest(route),/PRIVACY_BLOCK/);
});
test('default research-results route does not need irrelevant breeder forum checks',()=>{
 const dest=mk(entries,[],forums,cleanName,()=>{throw Error('unselected forum')},shrimps,results);
 assert.equal(dest(route),'research-results');
});

test('mislabeled Medaka catalog record cannot bypass shrimp destination privacy check',()=>{
 const wronglyGrouped=new Map([[route,{name:'Rinkou',group:'shrimp'}]]);
 const dest=mk(wronglyGrouped,[],forums,cleanName,c=>{
  if(c.id==='shrimp-guides')throw Error('PRIVACY_BLOCK shrimp-guides');
 },shrimps,results);
 assert.throws(()=>dest(route),/PRIVACY_BLOCK/);
});
