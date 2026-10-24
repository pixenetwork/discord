import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('function meaningful(main){');
const end=src.indexOf('async function getPage(url){',start);
assert.ok(start>=0&&end>start,'Locate real content digest normalizer');
const normalize=new Function(src.slice(start,end)+'return meaningful;')();

test('normal HTML comment, script and style elimination retains visible source order',()=>{
 const input=' A <!--private--> B <script type="module">bad()</script> C <style>.x{color:red}</style> D ';
 assert.equal(normalize(input),'A B C D');
});
test('handle script closing tag with whitespace without retaining hidden script',()=>{
 assert.equal(normalize('A<script>bad()</script >B'),'AB');
});
test('handle style closing tag with whitespace without retaining stylesheet',()=>{
 assert.equal(normalize('A<style>.x{}</style  >B'),'AB');
});
test('handle case-insensitive script and comments with source whitespace collapse',()=>{
 assert.equal(normalize('one <!--ignored--> \n<SCRIPT data-a="x">let x = 2</SCRIPT>  two'),'one two');
});
test('unterminated comment is retained for backwards-compatible digesting',()=>{
 assert.equal(normalize('A <!-- open comment'), 'A <!-- open comment');
});
test('tag-like words are not mistakenly removed as raw script elements',()=>{
 assert.equal(normalize('A<scripts>keep</scripts>B'),'A<scripts>keep</scripts>B');
});
