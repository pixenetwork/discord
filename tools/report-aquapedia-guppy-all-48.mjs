import fs from 'node:fs';
import {reconcileAllGuppyShowIndexes} from '../src/aquapedia-guppy-final-index-reconciliation.mjs';
const json=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const original=json('test/fixtures/guppypedia-source-20261021.json');
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(16000)});
if(!response.ok)throw new Error('Live source catalog unavailable '+response.status);
const site=await response.json();
const actual=site.filter(x=>x.group==='guppy').map(x=>({name:x.name,slug:x.slug,url:x.url,group:x.group,type:x.type,status:x.status}));
if(JSON.stringify(actual)!==JSON.stringify(original))throw new Error('Live Guppypedia research drift — do not reuse old receipts');
const base=json('resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const rest=json('resources/aquapedia-guppy-remaining-live-receipts-20261022.json');
const release=json('resources/aquapedia-cross-taxa-release-review-20261021.json');
const result=reconcileAllGuppyShowIndexes(actual,base,rest,release);
const output={capturedAt:new Date().toISOString(),sourceCatalogTotal:site.length,
 sourceCatalogGuppyCount:actual.length,scope:'source-only IKGH show-standard terminology; no pedigree',
 ...result};
const path='resources/aquapedia-guppy-all-48-live-release-20261022.json';
if(fs.existsSync(path))throw new Error('Existing release ledger must not be overwritten');
fs.writeFileSync(path,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
// Receipt details remain exclusively in the guarded write-once ledger.
// Do not log untrusted live catalog or message metadata.
console.log('GUPPYPEDIA_ALL_IKGH_INDEX_RELEASE: receipt ledger recorded; review only');
