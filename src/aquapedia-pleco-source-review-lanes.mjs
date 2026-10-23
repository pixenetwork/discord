/**
 * Offline editorial triage of 85 already drafted Pleco backlink proposals.
 * Neither HTTP status nor live-thread metadata proves a biological claim.
 * No network, credentials, message writing or release authorization.
 */
const stop=reason=>{throw new Error('Pleco source-review lanes: '+reason)};
const allowedStatus=new Set(['reachable_head','http_status','head_unavailable']);
const key=s=>typeof s==='string'&&s.startsWith('https://aquapedia.app/plecopedia/research/');
export function classifyPlecoSourceReview(manifest,citations,head){
 if(manifest?.publicationAuthorized!==false||
    !Array.isArray(manifest.proposals)||manifest.proposals.length!==99||
    citations?.publicationAuthorized!==false||
    !Array.isArray(citations.records)||citations.records.length!==143||
    head?.publicationAuthorized!==false||head.sourceClaimsVerified!==false||
    !Array.isArray(head.affectedUrls)||head.affectedUrls.length!==6||
    !Array.isArray(head.checks)||head.checks.length!==109)
  stop('untrusted or changed evidence snapshots');
 const urls=new Map();
 for(const citation of citations.records){
  if(typeof citation?.url!=='string'||urls.has(citation.url)||
     !Array.isArray(citation.links)||citation.links.length===0)
   stop('duplicate or invalid citation record');
  urls.set(citation.url,citation);
 }
 const checks=new Map();
 for(const x of head.checks){
  if(typeof x?.url!=='string'||checks.has(x.url)||
     !allowedStatus.has(x.outcome))
   stop('invalid source HEAD check');
  checks.set(x.url,x);
 }
 const restricted=new Set(head.affectedUrls);
 const pleco=manifest.proposals.filter(p=>p.group==='pleco');
 if(pleco.length!==85)stop('Pleco original proposal count drift');
 const seen=new Set();
 const rows=pleco.map(p=>{
  if(p.publicationAuthorized!==false||p.approval!=='not-granted'||
     typeof p.id!=='string'||seen.has(p.id)||
     p.targetKind!=='existing-thread'||typeof p.archived!=='boolean'||
     !/^[0-9]{17,20}$/.test(p.existingThreadId)||
     !Array.isArray(p.sourceUrls)||p.sourceUrls.length!==1||
     !key(p.sourceUrls[0]))
   stop('unsafe or duplicate proposal');
  seen.add(p.id);
  const url=p.sourceUrls[0], evidence=urls.get(url);
  if(!evidence)stop('no source evidence for '+p.id);
  const restrictedByHead=evidence.links.every(link=>checks.get(link)?.outcome!=='reachable_head');
  if(restricted.has(url)!==restrictedByHead)
   stop('stale or contradictory source-head evidence');
  return {
   proposalId:p.id,existingThreadId:p.existingThreadId,sourceUrl:url,
   archived:p.archived,sourceLinks:evidence.links.length,
   sourceAccessLane:restrictedByHead?'ACCESS_RESTRICTED_REVIEW':'HEAD_REACHABLE_UNVERIFIED',
   threadLane:p.archived?'ARCHIVED_HOLD':'ACTIVE_REVIEW',
   sourceClaimVerified:false,mediaReuseApproved:false,canPublish:false
  };
 });
 if(rows.length!==85||new Set(rows.map(p=>p.existingThreadId)).size!==85)
  stop('unexpected existing thread identity mapping');
 const restrictedRows=rows.filter(p=>p.sourceAccessLane==='ACCESS_RESTRICTED_REVIEW');
 const active=rows.filter(p=>!p.archived),archived=rows.filter(p=>p.archived);
 if(active.length!==55||archived.length!==30||restrictedRows.length!==6||
    restrictedRows.filter(p=>p.archived).length!==3)
  stop('source-review cohort count drift');
 return {
  schema:'aquapedia.plecopedia.source-access-review-lanes.v1',
  plecoCandidates:85,activeReview:55,archivedHeld:30,
  accessRestrictedReview:6,restrictedActive:3,restrictedArchived:3,
  headReachableUnverified:79,activeOther:52,archivedOther:27,
  rows,releaseAuthorized:false,claimsVerified:0,photoLicensesApproved:0,
  discordWrites:0,analysisType:'HEAD-status triage only; 403 does not prove a link broken',
 };
}
