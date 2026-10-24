// Decide which existing article-notification destinations require private-channel preflight.
// All records are already-public article URLs, but Discord notifications remain private.
export function requiredChannelKinds(changes,cap=50){
 if(!Array.isArray(changes))throw new Error('Expected changed-article array');
 if(!Number.isInteger(cap)||cap<1||cap>50)throw new Error('Invalid article batch cap');
 const kinds=new Set();
 for(const route of changes.slice(0,cap)){
  if(typeof route!=='string'||!/^\/(?:medakapedia|shrimpapedia|arowanapedia)\//.test(route)||/\.\.|[?#<>"']/.test(route)||!route.endsWith('/'))
   throw new Error('Unsupported article route in Discord privacy preflight');
  kinds.add(route.startsWith('/shrimpapedia/')?'shrimp':'research');
 }
 return ['research','shrimp'].filter(k=>kinds.has(k));
}
/**
 * Select only pages from THIS capped pass that could cause a Discord write.
 * New articles already independently announced by the metadata publisher are
 * adopted into the article checkpoint without a Discord PATCH or POST.
 */
export function channelWriteCandidates(changes,cap,trackedPages,announcedSources){
 if(!Array.isArray(changes)||!Number.isInteger(cap)||cap<1||cap>50)
  throw Error('Invalid changed article batch');
 if(!trackedPages||typeof trackedPages!=='object'||Array.isArray(trackedPages)||!(announcedSources instanceof Set))
  throw Error('Invalid existing article checkpoint or announced source set');
 return changes.slice(0,cap).filter(route=>Object.hasOwn(trackedPages,route)||!announcedSources.has(route));
}
