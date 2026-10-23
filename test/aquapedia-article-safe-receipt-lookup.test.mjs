import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file = new URL('../tools/aquapedia-article-content-watch-20261015.mjs', import.meta.url);
const content = fs.readFileSync(file, 'utf8');
const expression = content.match(/message=await rest\.get\(Routes\.channelMessage\(channel,old\.messageId\)\);/);
assert.ok(expression, 'candidate must contain fail-closed retrieval');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const getMessage = new AsyncFunction('rest','Routes','channel','old','let message=null; '+expression[0]+'; return message;');
for (const status of [403,404,429,500,503]) {
 test('recorded receipt GET HTTP '+status+' fails closed', async()=>{
   let posts=0,patches=0;
   const rest={get:async()=>{const e=new Error('HTTP '+status); e.status=status; throw e;},post:async()=>{posts++},patch:async()=>{patches++}};
   await assert.rejects(()=>getMessage(rest,{channelMessage:()=>'/message'},'channel',{messageId:'old-id'}), {status});
   assert.equal(posts,0);assert.equal(patches,0);
 });
}
test('recorded receipt GET timeout fails closed',async()=>{
  await assert.rejects(()=>getMessage({get:async()=>{throw new Error('timeout');}},{channelMessage:()=>'/message'},'channel',{messageId:'old-id'}),/timeout/);
});
test('recorded receipt GET success returns original message',async()=>{
  const existing={id:'old-id',author:{bot:true}};
  assert.equal(await getMessage({get:async()=>existing},{channelMessage:()=>'/message'},'channel',{messageId:'old-id'}),existing);
});