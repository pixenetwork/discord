const GUILD = '1519337502379475095';
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_URL = /^https:\/\/[^\s<>"']+$/i;
function clean(value) { return String(value ?? '').replace(/@(?=everyone|here)/gi, '@\u200b').replace(/<@/g, '<@\u200b').trim(); }
export function validateLineageManifest(manifest) {
  if(manifest?.schema_version!==1 || !Array.isArray(manifest.trees) || !manifest.trees.length) throw Error('Invalid manifest');
  const seen=new Set();
  for(const item of manifest.trees) {
    if(!SAFE_SLUG.test(item.slug??'') || !item.name || !SAFE_URL.test(item.site_url??'')) throw Error('Invalid lineage identity, slug or site URL');
    if(seen.has(item.slug)) throw Error('Duplicate lineage slug: '+item.slug);
    seen.add(item.slug);
    if(item.source_url!==null && item.source_url!==undefined && !SAFE_URL.test(item.source_url)) throw Error('Source must be HTTPS: '+item.slug);
    if(item.source_url && !item.source_title) throw Error('Source title missing: '+item.slug);
    if(item.source_url===null && item.evidence_state!=='parentage_undocumented') throw Error('Missing original citation for documented lineage: '+item.slug);
    if(item.existing_picture_discord_message_url && !new RegExp('^https://discord\\.com/channels/'+GUILD+'/\\d{17,20}/\\d{17,20}$').test(item.existing_picture_discord_message_url)) throw Error('Invalid Discord picture URL for '+item.slug);
    if(!Array.isArray(item.parents_or_stages)) throw Error('Parents/stages must be an array');
  }
  return {ok:true,count:seen.size};
}
export function formatLineagePost(entry, {forumUrl=null,indexUrl=null}={}) {
  const info = Array.isArray(entry.parents_or_stages) ? entry.parents_or_stages : [];
  let lines = ['🌳 **'+clean(entry.name)+' — Medaka lineage / pedigree tree**'];
  if (entry.source_url) {
    lines.push('**Breeder-reported stock / selection:** '+(info.length?info.map(clean).join(' • '):'No specific ancestor fish documented'));
    lines.push('**Evidence limits:** '+clean(entry.claim_limits));
    lines.push('**Original source:** '+clean(entry.source_title));
    lines.push(entry.source_url);
  } else {
    lines.push('**Parent lines not documented.** No breeder/publisher source currently establishes a parental cross.');
    lines.push('**Source for this research record:** '+clean(entry.source_title));
  }
  lines.push('**Aquapedia picture tree and dossier:** '+entry.site_url);
  if(forumUrl)lines.push('**Strain forum/tree discussion:** '+forumUrl);
  if(indexUrl)lines.push('**Browse the complete tree channel:** '+indexUrl);
  lines.push('[AQUAPEDIA-MEDAKA-LINEAGE-V2:'+entry.slug+']');
  let output=lines.join('\n');
  if(output.length>1950)throw Error('Lineage message would exceed Discord limits: '+entry.slug);
  return output;
}
export function extractLineageSvg(page) {
  const match=String(page??'').match(/<figure class="lineage-picture"[^>]*>[\s\S]*?(<svg\b[\s\S]*?<\/svg>)/i);
  if(!match || !match[1].includes('xmlns="http://www.w3.org/2000/svg"'))throw Error('Current SVG picture tree missing');
  return match[1];
}
