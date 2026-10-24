import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPlecoTaxonomySourceIndex,PLECO_TAXONOMY_SOURCE_LINKS} from '../src/aquapedia-pleco-seven-taxonomy-index.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/plecopedia-public-source-20261021.json',import.meta.url),'utf8'));
test('seven source-only taxonomy links have unique existing forum threads and original DOI references',()=>{
 const names=Object.keys(PLECO_TAXONOMY_SOURCE_LINKS);
 assert.equal(names.length,7);
 const posts=names.map(x=>buildPlecoTaxonomySourceIndex(catalog,x));
 assert.equal(new Set(posts.map(x=>x.threadId)).size,7);
 assert.ok(posts.every(x=>x.sourceUrl.startsWith('https://aquapedia.app/plecopedia/research/')&&x.content.includes('doi.org/')));
 assert.ok(posts.every(x=>x.content.includes('not an authentication')&&!x.taxonomyClaimVerified&&!x.geneticLineageVerified));
 assert.ok(posts.every(x=>x.content.includes(x.marker)&&x.content.length<1100&&x.mediaAttachments===0));
});
test('unrecognized species, status drift and missing sources fail closed',()=>{
 assert.throws(()=>buildPlecoTaxonomySourceIndex(catalog,'l025'),/Pleco taxonomy source index/);
 assert.throws(()=>buildPlecoTaxonomySourceIndex(catalog.slice(1),'bary-hadrostomus'),/Pleco taxonomy source index/);
 assert.throws(()=>buildPlecoTaxonomySourceIndex(catalog.map(x=>x.slug==='bary-hadrostomus'?{...x,status:'Verified'}:x),'bary-hadrostomus'),/Pleco taxonomy source index/);
});
