/**
 * Read-only, source-revalidated review preview for Corydoraspedia.
 * Deliberately no Discord dependency, bot token, channel mutation or checkpoint.
 */
import fs from 'node:fs';
import {buildCorySectionLinkReview} from '../src/aquapedia-cory-section-link-review.mjs';
const sourceURL='https://aquapedia.app/assets/catalog.json';
const snapshot=JSON.parse(fs.readFileSync('test/fixtures/corydoraspedia-thread-review-20261021.json','utf8'));
const response=await fetch(sourceURL,{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Source catalog unavailable '+response.status);
const all=await response.json();
const source=all.filter(r=>r.group==='corydoras');
const plan=buildCorySectionLinkReview(source,snapshot);
for(const path of ['/corydoraspedia/breeding/','/corydoraspedia/lineages/']){
 const r=await fetch('https://aquapedia.app'+path,{signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Source section unavailable '+path);
 const html=await r.text();
 for(const item of source.filter(x=>x.url.startsWith(path))){
  const anchor=item.url.split('#')[1];
  if(!html.includes('id="'+anchor+'"')&&!html.includes("id='"+anchor+"'"))
   throw Error('Broken live Corydoraspedia anchor '+item.url);
 }
}
const lines=[
 '# Corydoraspedia existing-thread backlink review — NOT POSTED',
 '',
 '> Inert draft for editorial review. Nothing here is approval to unarchive or edit any Discord thread, assert a founding pedigree, or present one keeper observation as a universal parameter.',
 '',
 '- Source: '+sourceURL+'; 19 source anchors revalidated on two live Aquapedia section pages.',
 '- Read-only bot-owned forum snapshot: '+snapshot.capturedAt+'.',
 '- Single candidate, route/status matched and draftable: '+plan.drafts.length+'.',
 '- More than one credible named destination: '+plan.ambiguous.length+'.',
 '- Single destination but taxon naming or lineage connection requires more review: '+plan.namingOrLineageReview.length+'.',
 '- Pending publication approval: 19/19. No new forums, threads, messages or automation.',
 '',
 '## Ten editorial drafts for existing source-matched species threads',
 ''
];
for(const [i,p] of plan.drafts.entries()){
 lines.push('### '+(i+1)+'. '+p.slug,
  '- Existing Discord thread: '+p.existingThreadUrl,
  '- Archived at capture: '+p.archived+' (reopening requires separate approval/preflight).',
  '- Site section: '+p.sourceUrl,
  '',
  '```text',p.content,'```','');
}
lines.push('## Seven ambiguous morph-to-parent-taxon cases — do not auto-post','');
for(const p of plan.ambiguous){
 lines.push('### '+p.slug, '- Source: '+p.sourceUrl,
 '- Reason: '+p.reason,
 ...p.candidates.map(c=>'- Candidate: '+c.name+' — '+c.threadUrl),
 '');
}
lines.push('## Two citation/taxonomic review holds','');
for(const p of plan.namingOrLineageReview){
 lines.push('### '+p.slug,'- Source: '+p.sourceUrl,'- Hold: '+p.reason,
 ...p.candidates.map(c=>'- Existing candidate: '+c.name+' — '+c.threadUrl),'');
}
lines.push('## Supporting external references, with limitations',
 '',
 '- Eschmeyer’s Catalog of Fishes (reviewed in October 2026) lists **Hoplisoma weitzmani** (Nijssen 1971) as the current valid combination: https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=4922 — the existing Discord forum title uses **weitzmanii**. Flag for a potential title correction; do not silently edit or treat as two species.',
 '- The Catfish Study Group, Journal Vol. 18(2), June 2017, “The laser corys,” reports a red-laser CW023 F2 line selected from orange-stripe CW023 stock, based on a firsthand account: https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf . This establishes reported line evidence, not universal proof that all “Red Laser” specimens share identical founding stock.',
 '- The 2024 Corydoradinae revised classification and 2025 nomenclatural correction still require claim-specific taxonomy review: https://doi.org/10.1093/zoolinnean/zlae053 ; https://doi.org/10.1093/zoolinnean/zlaf035 .',
 '',
 'No image, magazine translation or copyrighted source text is republished in these drafts.'
);
const dest='docs/operations/corydoraspedia-section-link-preview-20261021.md';
if(fs.existsSync(dest))throw Error('Destination exists; cannot overwrite');
fs.writeFileSync(dest,lines.join('\n')+'\n',{encoding:'utf8',flag:'wx'});
console.log('CORY_SECTION_PREVIEW_VERIFIED: review-only artifact created');
