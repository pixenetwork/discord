import fs from 'node:fs';
import {reconcileFourCorySourceLinks} from '../src/aquapedia-cory-four-reconciliation.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const prior=read('resources/aquapedia-guppy-all-48-live-release-20261022.json');
const receipts=read('resources/aquapedia-cory-four-live-receipts-20261022.json');
const history=read('resources/aquapedia-cross-taxa-release-review-20261021.json');
const res=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
if(!res.ok)throw Error('Live Aquapedia catalog HTTP '+res.status);
const catalog=await res.json();
const cory=catalog.filter(x=>x.group==='corydoras');
const result=reconcileFourCorySourceLinks(cory,receipts,prior,history);
const full={time:new Date().toISOString(),liveSourceTotal:catalog.length,liveCoryCount:cory.length,
 previousGuppyReceiptsVerified:true,...result,notes:'Public source links only; historical review manifest retained'};
const path='resources/aquapedia-cross-taxa-post-cory-review-20261022.json';
if(fs.existsSync(path))throw Error('Existing report cannot overwrite');
fs.writeFileSync(path,JSON.stringify(full,null,2)+'\n',{flag:'wx'});
console.log('CORY_FOUR_LIVE_RECONCILED '+JSON.stringify(full));
