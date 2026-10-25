import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {channelWriteCandidates} from '../tools/aquapedia-article-destination-policy.mjs';
import {assertTrackedRouteCoverage} from '../tools/aquapedia-article-route-integrity.mjs';

const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const pendingUrl='/shrimpapedia/breeders/verified-new/';
const pendingKey='article-v1-example';
const pendingReceipt={key:pendingKey,url:pendingUrl,channel:'private-shrimp',messageId:null,status:'pending'};

test('pending receipt cannot be silently adopted from later metadata verified announcement',()=>{
 const receiptMap={[pendingKey]:pendingReceipt};
 const candidates=channelWriteCandidates([pendingUrl],50,{},new Set([pendingUrl]),receiptMap);
 assert.deepEqual(candidates,[pendingUrl]);
 assert.match(src,/!state\.receipts\[key\]&&announcedCatalogPages\.has\(url\)/);
});
test('pending receipt URL remains in coverage inventory even before first saved article digest',()=>{
 assert.throws(()=>assertTrackedRouteCoverage(['/medakapedia/'],{}, {[pendingKey]:pendingReceipt}),/tracked.*missing/i);
});
test('valid pending receipt URL is accepted when still present in current route inventory',()=>{
 assert.doesNotThrow(()=>assertTrackedRouteCoverage([pendingUrl],{}, {[pendingKey]:pendingReceipt}));
});
test('adoption-only batches avoid Discord channel setup when nothing will be written',()=>{
 assert.match(src,/if\(!writeCandidates\.length\)\{/);
});
