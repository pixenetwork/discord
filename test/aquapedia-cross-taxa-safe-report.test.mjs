import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeSafeCrossTaxaPreflight} from '../src/aquapedia-cross-taxa-safe-report.mjs';

const safe={
 observedAt:'2026-10-22T21:05:00.000Z',distinctThreadCount:97,
 proposalCount:99,ownerVerified:97,completeReadWindow:97,
 alreadyLinked:1,partialLinked:2,missingLinks:96,
 archivedProposals:36,archiveDrift:1,lockedThreads:2,
 byGroup:{
  guppy:{total:4,linked:1,partial:0,missing:3},
  corydoras:{total:10,linked:0,partial:1,missing:9},
  pleco:{total:85,linked:0,partial:1,missing:84}
 },
 differences:[{reason:'archive-status-changed',
  receiptKey:'a'.repeat(64),threadId:'1560887812910350339'}],
 conclusion:'REVIEW_ONLY_NO_DISCORD_WRITES',
 publicationAuthorized:false,discordWrites:0
};
test('allowlisted safe preflight emits no Discord message or profile text',()=>{
 const output=serializeSafeCrossTaxaPreflight(safe,853);
 const result=JSON.parse(output);
 assert.equal(result.liveCatalogCount,853);
 assert.equal(result.observedAt,'2026-10-22T21:05:00.000Z');
 assert.equal(result.proposalCount,99);
 assert.equal(result.archiveDrift,1);
 assert.equal(result.differences[0].threadId,'1560887812910350339');
 assert.equal(result.action,'READ_ONLY');
 assert.equal(result.publicationAuthorized,false);
 assert.ok(!/\r|\n/.test(output));
 assert.ok(!output.includes('content'));
 assert.ok(!output.includes('authorId'));
});
test('reject injection via unexpected reason, IDs, control chars, counters or raw author fields',()=>{
 const mutated=[
  {...safe,observedAt:'2026-10-22\r\nFORGED'},
  {...safe,proposalCount:'99'},
  {...safe,ownerVerified:96},
  {...safe,byGroup:{...safe.byGroup,guppy:{...safe.byGroup.guppy,total:5}}},
  {...safe,differences:[{...safe.differences[0],threadId:'123\r\nadmin'}]},
  {...safe,differences:[{...safe.differences[0],reason:'archive-status-changed\nALLOWED'}]},
  {...safe,differences:[{...safe.differences[0],receiptKey:'a'.repeat(63)+'\n'}]},
  {...safe,conclusion:'REVIEW_ONLY_NO_DISCORD_WRITES\r\nPOSTED'},
  {...safe,publicationAuthorized:true}
 ];
 for(const example of mutated)
  assert.throws(()=>serializeSafeCrossTaxaPreflight(example,853),/Preflight safe report/);
 for(const count of [-1,853.5,NaN,Infinity,'853'])
  assert.throws(()=>serializeSafeCrossTaxaPreflight(safe,count),/Preflight safe report/);
});
test('schema does not copy untrusted optional payloads, flags or unknown keys',()=>{
 const result=JSON.parse(serializeSafeCrossTaxaPreflight({
  ...safe,otherText:'\nFORGED APPROVAL',messages:['private'],botToken:'secret',
  byGroup:{...safe.byGroup,pleco:{...safe.byGroup.pleco,content:'private body'}}
 },853));
 assert.ok(!JSON.stringify(result).includes('FORGED'));
 assert.ok(!JSON.stringify(result).includes('secret'));
 assert.ok(!JSON.stringify(result).includes('private'));
});
