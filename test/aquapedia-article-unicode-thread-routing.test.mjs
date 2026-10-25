import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('const cleanName=x=>');
const end=src.indexOf('const dest=url=>{',start);
assert.ok(start>=0&&end>start,'Find actual thread name normalizer');
const cleanName=new Function(src.slice(start,end)+'return cleanName;')();
test('Unicode em dash separates breeder thread qualifiers',()=>{
 assert.equal(cleanName('Rinkou — Ryurin'), 'rinkou');
});
test('fullwidth parenthetical breeder attribution separates from strain',()=>{
 assert.equal(cleanName('Harugiku（Toa）'), 'harugiku');
});
test('legitimate accented letters are preserved rather than split by mojibake',()=>{
 assert.equal(cleanName('Âme Blue'), 'âmeblue');
});
