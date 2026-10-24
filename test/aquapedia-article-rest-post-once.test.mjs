import test from 'node:test';
import assert from 'node:assert/strict';
import {REST} from 'discord.js';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const configMatch=source.match(/new REST\((\{[^)]*\})\)\.setToken\(token\)/);
assert.ok(configMatch,'Find production Discord REST constructor config');
const productionOptions=new Function('return '+configMatch[1])();

test('locked Discord REST implementation performs only one POST after AbortError',async()=>{
 let postAttempts=0;
 const rest=new REST({...productionOptions,hashSweepInterval:0,handlerSweepInterval:0,makeRequest:async()=>{
  postAttempts++;
  const error=new Error('simulated network timeout');
  error.name='AbortError';
  throw error;
 }}).setToken('test-not-real');
 try{
  await assert.rejects(()=>rest.post('/channels/123456789012345678/messages',{body:{content:'test'}}),/simulated network timeout/);
  assert.equal(rest.options.retries,0);
  assert.equal(postAttempts,1,'ambiguous create-message timeout must not trigger another POST');
 }finally{assert.equal(rest.options.retries,0)}
});
