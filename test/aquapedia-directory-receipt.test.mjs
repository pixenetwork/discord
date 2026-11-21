import test from 'node:test';
import assert from 'node:assert/strict';

const mod=await import('../src/aquapedia-directory.mjs');

test('directory receipt accepts only bounded Discord snowflakes from network readback',()=>{
 assert.equal(typeof mod.buildDirectoryReceipt,'function');
 const receipt=mod.buildDirectoryReceipt({
  guildId:'1519337502379475095',
  hubId:'1519337502379475096',
  messageId:'1519337502379475097',
  authorId:'1519337502379475098',
  pinned:true,
  targetIds:['1519337502379475099'],
  timestamp:'2026-11-04T21:30:00.000Z'
 });
 assert.equal(receipt.guildId,'1519337502379475095');
 assert.equal(receipt.messageId,'1519337502379475097');
 assert.equal(receipt.pinned,true);
 assert.match(receipt.url,/^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/);
 for(const bad of ['', '0', '../x', '123x', '9'.repeat(21)]){
  assert.throws(()=>mod.buildDirectoryReceipt({
   guildId:'1519337502379475095',hubId:'1519337502379475096',
   messageId:bad,authorId:'1519337502379475098',pinned:true,
   targetIds:['1519337502379475099'],timestamp:'2026-11-04T21:30:00.000Z'
  }),/snowflake|Discord/i);
 }
 assert.throws(()=>mod.buildDirectoryReceipt({
  guildId:'1519337502379475095',hubId:'1519337502379475096',
  messageId:'1519337502379475097',authorId:'1519337502379475098',pinned:true,
  targetIds:['not-an-id'],timestamp:'2026-11-04T21:30:00.000Z'
 }),/snowflake|Discord/i);
});
