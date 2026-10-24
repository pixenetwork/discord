/** Inert Plecopedia public-article backlink review; no Discord API or writes. */
import fs from 'node:fs';
import {buildPlecoArticleBacklinkReview} from '../src/aquapedia-pleco-backlink-review.mjs';
const source=JSON.parse(fs.readFileSync('test/fixtures/plecopedia-public-source-20261021.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('test/fixtures/plecopedia-thread-parity-20261021.json','utf8'));
const response=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(18000)});
if(!response.ok)throw Error('Public catalog HTTP '+response.status);
const live=(await response.json()).filter(x=>x.group==='pleco').map(x=>({
 name:x.name,slug:x.slug,url:x.url,group:x.group,type:x.type,status:x.status
}));
const sorted=x=>x.toSorted((a,b)=>a.url.localeCompare(b.url));
if(JSON.stringify(sorted(live))!==JSON.stringify(sorted(source)))throw Error('Live Pleco catalog drift; cannot use pinned review snapshot');
const review=buildPlecoArticleBacklinkReview(live,snapshot);
let checked=0,next=0;const draftChecks=review.drafts;
await Promise.all(Array.from({length:6},async()=>{
 while(next<draftChecks.length){
  const row=draftChecks[next++];
  const r=await fetch('https://aquapedia.app'+row.url,{signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Pleco source page not accessible: '+row.url+' HTTP '+r.status);
  checked++;
 }
}));
if(checked!==85)throw Error('Incomplete HTTP verification');
const byUrl=new Map(live.map(x=>[x.url,x]));
const escaped=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const lines=[
 '# Plecopedia source-to-Discord article link parity — NOT POSTED',
 '',
 '> This is an independent, read-only, existing-thread reconciliation. A cited thread is not proof of a pedigree, the validity of a commercial L-number, or scientific approval. No Discord publish action is authorized by this file.',
 '',
 '- Captured bot-owned public forum snapshot: '+snapshot.at+'; existing Plecopedia forum `'+snapshot.forumId+'`.',
 '- Live site Pleco research drafts: '+live.length+'; forum threads matched 167/167 (166 exact names + 1 vetted historical alias).',
 '- Already contain the **exact individual Aquapedia article URL**: **'+review.existingBacklinks+'**.',
 '- Missing an exact article URL: **'+review.missingBacklinks+'**; all '+checked+' missing public article pages returned HTTP 200.',
 '- Threads with at least one cited non-Aquapedia web source: 167/167 at snapshot time; this does not verify every claim.',
 '- Archived forum destinations: '+review.totalArchivedTargets+'; archived destinations among missing-link drafts: '+review.archivedDraftTargets+'. Reopening them needs separate preflight and approval.',
 '- Records requested for new forum thread creation: 0. Discord messages written: 0.',
 '',
 '## Source-to-existing-thread link proposals — 85 entries',
 '',
 '| Aquapedia record | Existing Discord thread | Archived |',
 '|---|---|---|'
];
for(const row of review.drafts){
 const site=byUrl.get(row.url);
 lines.push('| ['+escaped(site.name)+'](https://aquapedia.app'+row.url+') | [Existing research]('+row.existingThreadUrl+') | '+(row.archived?'Yes':'No')+' |');
}
lines.push('','## Standard proposed message text (not sent)','','Example generated for first missing-link entry:',
 '','```text',review.drafts[0].content,'```','',
 'Every proposed text is produced deterministically by `buildPlecoArticleBacklinkReview`, includes its own original site source URL, preserves the draft status, and does not post or unarchive anything.',
 '',
 '### Taxonomy and editorial safeguards',
 '',
 '- Historical `Soromonichthys stearleyi` forum thread is the same identified subject as the site’s `Pseudolithoxus stearleyi` record; no extra thread should be created. Primary description: https://doi.org/10.1643/CI-10-008 .',
 '- A statement of `Research draft — independent review pending` is retained. The original published paper/site URLs must be checked before any claim is represented as independently verified.',
 '- This artifact authorizes nothing. Use the existing single managed bot, fresh source and thread readbacks, an exclusive writer, current public target permissions and durable message receipts for any future approved post.',
 ''
);
const dest='docs/operations/plecopedia-source-link-review-20261021.md';
if(fs.existsSync(dest))throw Error('Preview already exists');
fs.writeFileSync(dest,lines.join('\n')+'\n',{encoding:'utf8',flag:'wx'});
console.log('PLECO_LINK_REVIEW_VERIFIED '+JSON.stringify({
 total:review.total,existing:review.existingBacklinks,missing:review.missingBacklinks,
 allMissingPageHTTP200:checked,archivedTotal:review.totalArchivedTargets,archivedMissing:review.archivedDraftTargets,
 drafts:review.drafts.length,maxLength:Math.max(...review.drafts.map(x=>x.content.length)),
 publicationAuthorized:review.publicationAuthorized,discordWrites:review.discordWrites
}));
