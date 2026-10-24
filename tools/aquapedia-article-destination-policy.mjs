// Decide which existing article-notification destinations require private-channel preflight.
// All records are already-public article URLs, but Discord notifications remain private.
export function requiredChannelKinds(changes,cap=50){
 if(!Array.isArray(changes))throw new Error('Expected changed-article array');
 if(!Number.isInteger(cap)||cap<1||cap>50)throw new Error('Invalid article batch cap');
 const kinds=new Set();
 for(const route of changes.slice(0,cap)){
  if(typeof route!=='string'||!/^\/(?:medakapedia|shrimpapedia|arowanapedia)\/[a-z0-9/-]+\/$/.test(route))
   throw new Error('Unsupported article route in Discord privacy preflight');
  kinds.add(route.startsWith('/shrimpapedia/')?'shrimp':'research');
 }
 return ['research','shrimp'].filter(k=>kinds.has(k));
}