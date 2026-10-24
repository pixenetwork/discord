/**
 * Fail closed if a source metadata refresh silently drops articles
 * previously represented by the verified article publisher checkpoint.
 * Route removals need a separate, documented retirement/reconciliation.
 */
export function assertTrackedRouteCoverage(currentRoutes, trackedPages){
 if(!Array.isArray(currentRoutes)||!trackedPages||typeof trackedPages!=='object'||Array.isArray(trackedPages))
  throw Error('Invalid current research route list or tracked article checkpoint');
 const current=new Set(currentRoutes);
 const tracked=Object.keys(trackedPages);
 const missing=tracked.filter(route=>!current.has(route));
 if(missing.length){
  throw Error('Previously tracked research routes missing from source inventory: '+
   missing.length+' tracked missing; examples='+missing.slice(0,8).join(', ')+
   '. Refuse publishing until routes are restored or separately retired with proof.');
 }
}
