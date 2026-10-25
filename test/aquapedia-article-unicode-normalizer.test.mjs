import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const from=source.indexOf('function meaningful(main){'),to=source.indexOf('async function getPage(url){',from);
assert.ok(from>=0&&to>from);
const meaningful=new Function(source.slice(from,to)+'return meaningful;')();
test('Unicode expanding lowercase before raw-text tag does not break HTML source offsets',()=>{
 assert.equal(meaningful('İA<script>hidden()</script>B'),'İAB');
 assert.equal(meaningful('İA<STYLE type="text/css">.secret{}</STYLE>B'),'İAB');
});
