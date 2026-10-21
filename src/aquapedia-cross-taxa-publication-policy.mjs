/**
 * READ-ONLY source/Discord parity planning policy for non-Medaka/Shrimp taxa.
 *
 * This module DOES NOT authorize public publication or issue Discord writes.
 * The live publisher's existing skip guards remain in force.
 */
const guppyStatuses=new Set(['Officially standardized phenotype','Trade label; lineage unverified']);
const coryStatuses=new Set(['Pedigree or genetics under review','Keeper observation; not a universal target']);
const cohorts=['guppy','pleco','corydoras'];
const deny=reason=>{throw new Error('Untrusted cross-taxa record: '+reason)};
const normalizedName=name=>String(name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function classifyCrossTaxaRecord(entry){
 if(!entry||typeof entry!=='object'||!cohorts.includes(entry.group)||typeof entry.url!=='string'||
    typeof entry.name!=='string'||!entry.name.trim()||typeof entry.status!=='string')
  deny('missing or unsupported group, identity or source URL');
 if(entry.group==='guppy'){
  if(!/^\/guppypedia\/entries\/gup-\d{3}\/$/.test(entry.url)
    ||entry.slug!=='guppy-'+entry.url.split('/')[3]
    ||typeof entry.type!=='string'||!entry.type.startsWith('Guppy ')
    ||!guppyStatuses.has(entry.status))deny('Guppypedia shape or evidence status changed');
  return {group:'guppy',kind:'article',decision:entry.status==='Officially standardized phenotype'?'review_required':'hold_unverified_trade'};
 }
 if(entry.group==='pleco'){
  if(!/^\/plecopedia\/research\/[a-z0-9-]+\/$/.test(entry.url)
   ||entry.status!=='Research draft — independent review pending')
   deny('Plecopedia draft identity/status changed');
  return {group:'pleco',kind:'article',decision:'hold_draft'};
 }
 if(!/^\/corydoraspedia\/(?:lineages|breeding)\/#[-a-z0-9]+$/.test(entry.url)
   ||!coryStatuses.has(entry.status))deny('Corydoraspedia anchored section/status changed');
 return {group:'corydoras',kind:'anchor',decision:'hold_anchor'};
}

/**
 * Offline/read-only plan; the thread inventory must have been independently
 * captured from active AND archived Discord threads. No approximate matching,
 * automatic thread creation, source permission, or mutable source checkpoint.
 */
export function buildCrossTaxaCoverage(catalog,threadInventory={},options={}){
 if(!Array.isArray(catalog)||!threadInventory||typeof threadInventory!=='object')throw TypeError('Untrusted audit inputs');
 const counts={guppy:0,pleco:0,corydoras:0};
 const byGroup=Object.fromEntries(cohorts.map(group=>[group,{total:0,exactMatches:0,pendingReview:0,held:0,unmatched:0,matchedThreadIds:[]}]));
 const seenUrls=new Set(),indexes={};
 for(const group of cohorts){
  const threads=threadInventory[group]??[];
  if(!Array.isArray(threads))throw TypeError('Untrusted thread inventory '+group);
  const idx=new Map(),usedIds=new Set();
  for(const thread of threads){
   if(!thread||typeof thread.name!=='string'||!thread.name.trim()||typeof thread.id!=='string'||!/^[0-9]+$/.test(thread.id))
    throw Error('Untrusted thread in '+group);
   if(usedIds.has(thread.id))throw Error('Duplicate Discord thread ID in '+group);
   usedIds.add(thread.id);
   const key=normalizedName(thread.name);
   if(idx.has(key))throw Error('Duplicate forum title in '+group+': '+thread.name);
   idx.set(key,thread.id);
  }
  indexes[group]=idx;
 }
 for(const record of catalog){
  const status=classifyCrossTaxaRecord(record);
  if(seenUrls.has(record.url))deny('duplicated catalog route '+record.url);
  seenUrls.add(record.url);
  counts[status.group]++;
  const row=byGroup[status.group];row.total++;
  if(status.decision==='review_required')row.pendingReview++;else row.held++;
  const threadId=indexes[status.group].get(normalizedName(record.name));
  if(threadId){row.exactMatches++;row.matchedThreadIds.push(threadId);}
  else row.unmatched++;
 }
 const expected=options.expectedCounts;
 if(expected){
  for(const group of cohorts){
   if(!Number.isSafeInteger(expected[group])||expected[group]!==counts[group])throw Error('Cohort count mismatch '+group+': expected '+expected[group]+', got '+counts[group]);
  }
 }
 const n=options.guildActiveThreads;
 return {
  total:catalog.length,byGroup,publicationAuthorized:false,newThreadsToCreate:0,
  guildThreadCapacitySafe:Number.isSafeInteger(n)&&n>=0&&n<950
 };
}
