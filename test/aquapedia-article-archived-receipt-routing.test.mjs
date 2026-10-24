import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveArticleReceiptChannel as choose} from '../tools/aquapedia-article-receipt-channel.mjs';
const archive={id:'old-thread',guild_id:'guild',type:11,parent_id:'breeder-forum',name:'Rinkou',thread_metadata:{archived:true}};
const receipt={messageId:'message-1',channel:'old-thread'};
const entry={name:'Rinkou',group:'medaka'};
function scenario(overrides={}){
 const calls=[];
 const opts={
  receipt,proposedChannel:'research-results',defaultChannel:'research-results',
  entry,guild:'guild',breederForums:[{id:'breeder-forum',name:'Private breeder forum'}],
  getChannel:async id=>{calls.push('get:'+id);return archive;},
  privateDestination:f=>calls.push('private:'+f.id),
  cleanName:s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,''),
  allowedThreadTypes:[11,12],...overrides
 };
 return {calls,run:()=>choose(opts)};
}
test('archived original thread remains destination with private parent verified',async()=>{
 const h=scenario();
 assert.equal(await h.run(),'old-thread');
 assert.deepEqual(h.calls,['get:old-thread','private:breeder-forum']);
});
test('normal existing receipt avoids unnecessary channel lookups',async()=>{
 const h=scenario({proposedChannel:'old-thread'});
 assert.equal(await h.run(),'old-thread');
 assert.deepEqual(h.calls,[]);
});
test('archive lookup transport failure fails closed',async()=>{
 const h=scenario({getChannel:async()=>{throw Error('Discord 429')}});
 await assert.rejects(h.run(),/Discord 429/);
});
test('old thread outside this guild must fail closed',async()=>{
 const h=scenario({getChannel:async()=>({...archive,guild_id:'other-guild'})});
 await assert.rejects(h.run(),/not a verified archived/);
});
test('old thread no longer archived or of wrong type fails closed',async()=>{
 const h=scenario({getChannel:async()=>({...archive,thread_metadata:{archived:false}})});
 await assert.rejects(h.run(),/not a verified archived/);
 const i=scenario({getChannel:async()=>({...archive,type:0})});
 await assert.rejects(i.run(),/not a verified archived/);
});
test('old receipt with a nonmatching private forum or article name fails closed',async()=>{
 const h=scenario({getChannel:async()=>({...archive,parent_id:'other'})});
 await assert.rejects(h.run(),/forum or article name mismatch/);
 const j=scenario({getChannel:async()=>({...archive,name:'Other Line'})});
 await assert.rejects(j.run(),/forum or article name mismatch/);
});
test('public breeder forum fails privacy gate',async()=>{
 const h=scenario({privateDestination:()=>{throw Error('PRIVACY_BLOCK public')}})
 await assert.rejects(h.run(),/PRIVACY_BLOCK/);
});
test('no fallback to archived breeder thread for shrimp or unknown destinations',async()=>{
 const h=scenario({entry:{name:'Rinkou',group:'shrimp'}});
 await assert.rejects(h.run(),/destination mismatch/);
 const j=scenario({proposedChannel:'another-active-thread'});
 await assert.rejects(j.run(),/destination mismatch/);
});
test('old receipt with missing message id is never inferred from thread',async()=>{
 const h=scenario({receipt:{channel:'old-thread'}});
 await assert.rejects(h.run(),/missing message ID/);
});
test('brand-new article uses validated proposed destination unchanged',async()=>{
 const h=scenario({receipt:null});
 assert.equal(await h.run(),'research-results');
 assert.deepEqual(h.calls,[]);
});
