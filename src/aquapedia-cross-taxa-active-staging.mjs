/**
 * Idempotent active-only review staging from pinned release candidates.
 * Neither an approval gate nor a publisher: no credentials, channels,
 * bot API, scheduler or filesystem mutation.
 */
import {createHash} from 'node:crypto';
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const reject=why=>{throw Error('Active staging: '+why)};
const groups=['guppy','corydoras','pleco'];
export function stageCrossTaxaActiveBatch(manifest){
 if(!manifest||manifest.publicationAuthorized!==false||
   manifest.discordWrites!==0||manifest.newThreadsToCreate!==0||
   !Array.isArray(manifest.proposals)||manifest.proposals.length!==99||
   manifest.counts?.proposedMessages!==99||
   manifest.counts?.archivedTargets!==36||
   manifest.counts?.activeTargets!==63)
   reject('invalid or edited review-only manifest');
 const seenId=new Set(),seenReceipt=new Set();
 const active=[],archived=[];
 for(const proposal of manifest.proposals){
  const p=proposal;
  if(!p||!groups.includes(p.group)||p.publicationAuthorized!==false||
   p.approval!=='not-granted'||p.targetKind!=='existing-thread'||
   typeof p.archived!=='boolean'||typeof p.content!=='string'||
   !/^\d{17,20}$/.test(p.existingThreadId||'')||
   !Array.isArray(p.sourceUrls)||!p.sourceUrls.length||
   p.sourceUrls.some(url=>!url.startsWith('https://aquapedia.app/'))||
   sha256(p.content)!==p.sha256)
   reject('proposal identity or preview checksum changed');
  const identity=[p.id,p.existingThreadId,p.sha256,...p.sourceUrls].join('|');
  if(sha256(identity)!==p.receiptKey||seenId.has(p.id)||seenReceipt.has(p.receiptKey))
   reject('duplicate ID or altered durable receipt');
  seenId.add(p.id);seenReceipt.add(p.receiptKey);
  if(p.archived)archived.push(p);else active.push(p);
 }
 const byGroup=Object.fromEntries(groups.map(group=>[group,active.filter(x=>x.group===group).length]));
 if(active.length!==63||archived.length!==36||
  byGroup.guppy!==4||byGroup.corydoras!==4||byGroup.pleco!==55||
  archived.filter(x=>x.group==='corydoras').length!==6||
  archived.filter(x=>x.group==='pleco').length!==30)
  reject('record or archive shape unexpectedly changed');
 const cap=12,batches=[];
 for(let i=0;i<active.length;i+=cap){
  const items=active.slice(i,i+cap);
  batches.push({index:batches.length+1,items,canPublish:false,requiresFreshPreflight:true,
   requiresAuthenticatedOwnerApproval:true,requiresIndependentSourceReview:true,
   requiresSingleWriterLock:true,requiresBotReadback:true,requiresDurableReceipt:true});
 }
 return {
  activeProposalCount:active.length,archivedHeld:archived.length,byGroup,
  batches,archived,publicationAuthorized:false,discordWrites:0,newThreadsToCreate:0,
  nextAction:'editorial review, existing owner/bot approval and fresh single-writer preflight'
 };
}
