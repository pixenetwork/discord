import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('public current queue is read-only, excludes four verified Cory links and counts 91',()=>{
 const cwd=new URL('..',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
 const cmd=spawnSync(process.execPath,['tools/read-aquapedia-cross-taxa-current-queue.mjs'],{cwd,encoding:'utf8'});
 assert.equal(cmd.status,0,cmd.stderr);
 const out=JSON.parse(cmd.stdout);
 assert.equal(out.pendingCount,91);
 assert.equal(out.activeCount,55);
 assert.equal(out.archivedHeld,36);
 assert.equal(out.verifiedGuppySourceLinks,48);
 assert.equal(out.verifiedCoryWorkingReportLinks,4);
 assert.deepEqual(out.byGroup,{corydoras:6,pleco:85});
 assert.equal(out.publicationAuthorized,false);
 assert.equal(out.discordWrites,0);
 assert.ok(out.activeBatches.every(x=>x.canPublish===false));
});
test('unapproved apply argument is rejected rather than activating a publisher',()=>{
 const cwd=new URL('..',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,'');
 const cmd=spawnSync(process.execPath,['tools/read-aquapedia-cross-taxa-current-queue.mjs','--apply'],{cwd,encoding:'utf8'});
 assert.notEqual(cmd.status,0);
 assert.match(cmd.stderr,/only optional --queue|Only optional --queue/);
});
