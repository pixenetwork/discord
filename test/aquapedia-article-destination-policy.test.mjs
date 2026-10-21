import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requiredChannelKinds} from '../tools/aquapedia-article-destination-policy.mjs';

test('only Medaka updates require the private research destination, not public shrimp-guides',()=>{
 assert.deepEqual(requiredChannelKinds([
  '/medakapedia/strains/silver-hikari-daruma-kirameki-oba/',
  '/medakapedia/strains/transparent-scale-sarasa/',
  '/medakapedia/strains/white-internal-light-saiko/',
 ]),['research']);
});

test('shrimp updates still require the private shrimp destination and cannot bypass the privacy check',()=>{
 assert.deepEqual(requiredChannelKinds(['/shrimpapedia/serrata-species/']),['shrimp']);
 assert.deepEqual(requiredChannelKinds(['/medakapedia/strains/sample/','/shrimpapedia/serrata-species/']),['research','shrimp']);
});

test('only changes selected by the capped apply batch are considered',()=>{
 assert.deepEqual(requiredChannelKinds(['/medakapedia/strains/sample/','/shrimpapedia/serrata-species/'],1),['research']);
});

test('unknown paths and malformed batches fail closed',()=>{
 assert.throws(()=>requiredChannelKinds(['/something-else/']),/unsupported/i);
 assert.throws(()=>requiredChannelKinds(['/medakapedia/strains/sample/'],0),/cap/i);
 assert.throws(()=>requiredChannelKinds('bad'),/array/i);
});
