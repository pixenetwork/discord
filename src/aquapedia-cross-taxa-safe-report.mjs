/**
 * Restrict externally sourced Discord metadata before emitting a diagnostic.
 * Never stream raw messages, names, author IDs, or untrusted text to console.
 * Report is read-only and cannot approve or publish anything.
 */
const reject=reason=>{throw new Error('Preflight safe report: '+reason)};
const groups=['guppy','corydoras','pleco'];
const integer=(value,label)=>{
 if(!Number.isSafeInteger(value)||value<0||value>100000)reject('invalid '+label);
 return value;
};
const snowflake=value=>typeof value==='string'&&/^[0-9]{17,20}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export function serializeSafeCrossTaxaPreflight(observed,liveCatalogCount){
 if(!observed||typeof observed!=='object'||Array.isArray(observed)||
    observed.publicationAuthorized!==false||observed.discordWrites!==0||
    observed.conclusion!=='REVIEW_ONLY_NO_DISCORD_WRITES'||
    !observed.byGroup||!Array.isArray(observed.differences))
   reject('unexpected or mutated readback');
 const when=new Date(observed.observedAt);
 if(typeof observed.observedAt!=='string'||!Number.isFinite(when.getTime()))
   reject('invalid observedAt');
 const counts={};
 for(const name of ['distinctThreadCount','proposalCount','ownerVerified',
   'completeReadWindow','alreadyLinked','partialLinked','missingLinks',
   'archivedProposals','archiveDrift','lockedThreads']){
  counts[name]=integer(observed[name],name);
 }
 if(counts.proposalCount!==99||counts.distinctThreadCount!==97||
    counts.ownerVerified!==97||
    counts.alreadyLinked+counts.partialLinked+counts.missingLinks!==99)
   reject('partial preflight snapshot');
 const byGroup={};
 for(const group of groups){
  const values=observed.byGroup[group];
  if(!values)reject('missing group '+group);
  byGroup[group]={};
  for(const key of ['total','linked','partial','missing'])
   byGroup[group][key]=integer(values[key],group+'/'+key);
  if(byGroup[group].linked+byGroup[group].partial+byGroup[group].missing!==byGroup[group].total)
   reject('invalid by-group counters');
 }
 const diff=observed.differences.map(entry=>{
  if(!entry||entry.reason!=='archive-status-changed'||
     !digest(entry.receiptKey)||!snowflake(entry.threadId))
    reject('unsafe or unexpected difference data');
  return {
   reason:'archive-status-changed',
   receiptKey:entry.receiptKey,
   threadId:entry.threadId
  };
 });
 if(diff.length!==counts.archiveDrift)reject('incomplete change details');
 const safe={
  observedAt:when.toISOString(),
  liveCatalogCount:integer(liveCatalogCount,'catalog total'),
  ...counts,byGroup,differences:diff,
  action:'READ_ONLY',conclusion:'REVIEW_ONLY_NO_DISCORD_WRITES',
  publicationAuthorized:false,discordWrites:0
 };
 return JSON.stringify(safe);
}
