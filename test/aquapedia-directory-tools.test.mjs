import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.join(import.meta.dirname,'..');
const publisher=fs.readFileSync(path.join(root,'tools','aquapedia-directory-publish-once.mjs'),'utf8');
const census=fs.readFileSync(path.join(root,'tools','discord-legacy-alias-census.mjs'),'utf8');

test('Discord council tools do not commit machine-specific user paths',()=>{
 assert.doesNotMatch(publisher,/C:\/Users\/duy/i);
 assert.doesNotMatch(census,/C:\/Users\/duy/i);
});

test('publisher and census expose portable file-path overrides',()=>{
 assert.match(publisher,/AQUAPEDIA_DIRECTORY_RECEIPT_PATH/);
 assert.match(census,/AQUAPEDIA_SNAPSHOT_PATH/);
 assert.match(census,/AQUAPEDIA_ALIAS_INVENTORY_PATH/);
});

test('publisher fails closed on malformed prior authors and keeps default receipt outside the source checkout',()=>{
 assert.match(publisher,/author\?\.id/);
 assert.match(publisher,/homedir\(\)|\.pixelnetwork/);
 assert.match(publisher,/source checkout|startsWith\(repo/);
});

test('census protects snapshot input from aliased output identities',()=>{
 assert.match(census,/statSync|realpathSync/);
 assert.match(census,/\.dev/);
 assert.match(census,/\.ino/);
 assert.match(census,/different files|same file/i);
});

test('legacy census requires a complete 31-channel child set and child-level privacy evidence',()=>{
 assert.match(census,/AQUAPEDIA_MIGRATION_HOLD_EXPECTED_COUNT/);
 assert.match(census,/privateChannelVerified/);
});
