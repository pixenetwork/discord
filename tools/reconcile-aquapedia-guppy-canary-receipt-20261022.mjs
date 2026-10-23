/**
 * Read-only reconciliation of the verified Guppypedia canary publication.
 * No Discord client, no writes to Discord, no automatic release approval.
 */
import fs from 'node:fs';
import {reconcileSourceOnlyCanary} from '../src/aquapedia-cross-taxa-canary-reconciliation.mjs';
const file=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=file('resources/aquapedia-cross-taxa-release-review-20261021.json');
const receipt=file('resources/aquapedia-guppy-base-index-live-receipt-20261022.json');
const frozen=file('test/fixtures/guppypedia-source-20261021.json');
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Cannot verify live site: '+response.status);
const catalog=await response.json();
const guppies=catalog.filter(x=>x.group==='guppy').map(x=>({
 name:x.name,slug:x.slug,url:x.url,group:x.group,type:x.type,status:x.status
}));
if(JSON.stringify(guppies)!==JSON.stringify(frozen))
 throw Error('Guppy catalog changed since receipt; a new review is required');
const r=reconcileSourceOnlyCanary(manifest,guppies,receipt);
const final={...r,liveCatalogTotal:catalog.length,verifiedReceipt:receipt.url,
 originalReviewProposalCount:manifest.proposals.length,
 originalReviewManifestsUnchanged:true,
 remainingRequireSourceAndEditorialReview:true,
 documentationOnly:true};
const dest='resources/aquapedia-cross-taxa-post-canary-review-20261022.json';
if(fs.existsSync(dest))throw Error('Review reconciliation already exists');
fs.writeFileSync(dest,JSON.stringify(final,null,2)+'\n',{flag:'wx'});
console.log('CROSS_TAXA_POST_CANARY_RECONCILED '+JSON.stringify(final));
