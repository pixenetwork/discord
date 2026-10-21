import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requiredChannelKinds,articleWriteAction,ARTICLE_UPDATE_HEADING,normalizeAquapediaArticleName,acquireArticleWriterLock} from '../tools/aquapedia-article-destination-policy.mjs';

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

test('Arowanapedia updates cannot silently enter the Medaka research destination',()=>{
 assert.throws(()=>requiredChannelKinds(['/arowanapedia/strains/super-red/']),/unsupported/i);
});

test('actual Discord operation determines posted/updated, not prior receipt',()=>{
 assert.equal(articleWriteAction({previousReceipt:true,existingMessage:false,changed:true}),'posted');
 assert.equal(articleWriteAction({previousReceipt:false,existingMessage:true,changed:true}),'updated');
 assert.equal(articleWriteAction({previousReceipt:true,existingMessage:true,changed:false}),'unchanged');
});

test('human-readable article heading and Unicode name normalization are not corrupted',()=>{
 assert.equal(ARTICLE_UPDATE_HEADING,'**AQUAPEDIA \u2014 UPDATED RESEARCH ARTICLE**');
 assert.equal(normalizeAquapediaArticleName('Silver Hikari Daruma (Kirameki \u2014 Oba)'),'silverhikaridaruma');
 assert.equal(normalizeAquapediaArticleName('White Internal Light \u2014 Saiko'),'whiteinternallight');
 assert.equal(normalizeAquapediaArticleName('Name \uff08other\uff09'),'name');
});

test('writer lock cleans up after metadata write failure, but never unlinks a competing lock',()=>{
 const calls=[];
 const failingWrite={openSync(){calls.push('open');return 19},writeSync(){calls.push('write');throw Error('metadata write failed')},
   closeSync(){calls.push('close')},unlinkSync(){calls.push('unlink')}};
 assert.throws(()=>acquireArticleWriterLock(failingWrite,'lock',{job:'test'}),/metadata write failed/);
 assert.deepEqual(calls,['open','write','close','unlink']);
 const busy=[];
 const competing={openSync(){busy.push('open');throw Object.assign(Error('busy'),{code:'EEXIST'})},
   writeSync(){busy.push('write')},closeSync(){busy.push('close')},unlinkSync(){busy.push('unlink')}};
 assert.throws(()=>acquireArticleWriterLock(competing,'lock',{job:'test'}),/busy/);
 assert.deepEqual(busy,['open']);
});

test('successful writer lock releases its own handle and file exactly once',()=>{
 const calls=[];
 const api={openSync(){calls.push('open');return 25},writeSync(){calls.push('write')},
   closeSync(){calls.push('close')},unlinkSync(){calls.push('unlink')}};
 const release=acquireArticleWriterLock(api,'lock',{job:'test'});
 release();
 assert.deepEqual(calls,['open','write','close','unlink']);
});

test('unknown paths and malformed batches fail closed',()=>{
 assert.throws(()=>requiredChannelKinds(['/something-else/']),/unsupported/i);
 assert.throws(()=>requiredChannelKinds(['/medakapedia/strains/sample/'],0),/cap/i);
 assert.throws(()=>requiredChannelKinds('bad'),/array/i);
});
