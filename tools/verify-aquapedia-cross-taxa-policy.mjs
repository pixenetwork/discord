/**
 * Read-only live-source shape audit for the 362 excluded cross-taxa entries.
 * Does not access Discord or touch publisher checkpoints.
 */
import {buildCrossTaxaCoverage} from '../src/aquapedia-cross-taxa-publication-policy.mjs';
const url='https://aquapedia.app/assets/catalog.json';
const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Aquapedia catalog unavailable: HTTP '+response.status);
const catalog=await response.json();
if(!Array.isArray(catalog)||catalog.length<850)throw Error('Unexpected live catalog shrinkage');
const excluded=catalog.filter(x=>['guppy','pleco','corydoras'].includes(x.group));
const plan=buildCrossTaxaCoverage(excluded,{},{
 expectedCounts:{guppy:176,pleco:167,corydoras:19},
 guildActiveThreads:null
});
if(plan.total!==362||plan.publicationAuthorized||plan.newThreadsToCreate)
 throw Error('Unexpected cross-taxa publishing authorization');
console.log('CROSS_TAXA_SOURCE_AUDIT '+JSON.stringify({
 catalogTotal:catalog.length,excludedTotal:plan.total,
 cohorts:Object.fromEntries(Object.entries(plan.byGroup).map(([g,v])=>[g,{records:v.total,held:v.held,reviewRequired:v.pendingReview}])),
 writes:0,publicationAuthorized:false
}));
