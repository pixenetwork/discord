import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url));
test('explicit --check cannot be combined with one-time migration mode',()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'aquapedia-mixed-flags-'));
 try{
  const r=spawnSync(process.execPath,[script,'--check','--migrate-shrimp-private'],{
   cwd,env:{...process.env,AQUAPEDIA_PRIVATE_SHRIMP_MIGRATION_APPROVAL:''},
   encoding:'utf8',timeout:8000,
  });
  assert.equal(r.status,1);
  assert.match(r.stderr,/Do not combine private migration with/i);
  assert.doesNotMatch(r.stderr,/ENOENT|no such file or directory/i);
 }finally{fs.rmSync(cwd,{recursive:true,force:true})}
});
