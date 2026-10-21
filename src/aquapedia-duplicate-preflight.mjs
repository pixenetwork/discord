// Pure, read-only decision for the two verified legacy empty research forums.
// This does not rename, delete, publish or modify any Discord resource.
export const LEGACY_FORUMS = Object.freeze([
  { id: '1562207090670305280', name: '🦐・shrimp-research', canonicalId: '1561189288090140743', proposedName: '🗃️・legacy-empty-shrimp-hold' },
  { id: '1562207092239110264', name: '🐉・arowana-research', canonicalId: '1561193084899819680', proposedName: '🗃️・legacy-empty-arowana-hold' },
]);
export const INTRO_ID = '1557338241903099945';
export const SPECIES_ID = '1561430495680667719';

export function assessLegacyForums({ channels, activeThreads, archivedById, directories, guildId }) {
  const blockers = [];
  if (guildId !== '1519337502379475095') blockers.push('unexpected_guild');
  const all = Array.isArray(channels) ? channels : [];
  const active = Array.isArray(activeThreads) ? activeThreads : [];
  if (!all.some(c => c.id === INTRO_ID && c.type === 4 && c.name === '📚・AQUAPEDIA')) blockers.push('intro_category_drift');
  if (!all.some(c => c.id === SPECIES_ID && c.type === 4 && c.name === '🧬・AQUAPEDIA — SPECIES & GENETICS')) blockers.push('species_category_drift');
  const snapshots = [];
  for (const spec of LEGACY_FORUMS) {
    const legacy = all.find(c => c.id === spec.id);
    const canonical = all.find(c => c.id === spec.canonicalId);
    if (!legacy || legacy.type !== 15 || legacy.parent_id !== INTRO_ID || legacy.name !== spec.name) blockers.push('legacy_forum_drift:'+spec.id);
    if (!canonical || canonical.type !== 15 || canonical.parent_id !== SPECIES_ID || canonical.name !== spec.name) blockers.push('canonical_forum_drift:'+spec.canonicalId);
    if (all.some(c => c.name === spec.proposedName)) blockers.push('proposed_name_taken:'+spec.proposedName);
    const activeCount = active.filter(t => t.parent_id === spec.id).length;
    const archived = archivedById?.[spec.id];
    if (!archived || !Number.isSafeInteger(archived.count) || archived.hasMore !== false || archived.count < 0) blockers.push('archived_history_incomplete:'+spec.id);
    if (activeCount !== 0 || (archived?.count??-1)!==0) blockers.push('legacy_forum_not_empty:'+spec.id);
    const directoryHits = (directories ?? []).filter(x => typeof x.content === 'string' && x.content.includes(spec.id)).map(x => x.id);
    if (directoryHits.length) blockers.push('known_directory_references:'+spec.id);
    snapshots.push({legacyId:spec.id, canonicalId:spec.canonicalId, oldName:spec.name, proposedName:spec.proposedName, activeThreads:activeCount, archivedThreads:archived?.count??null, directoryHits});
  }
  if (!Array.isArray(directories) || directories.length !== 6 || directories.some(x => !x.id || typeof x.content !== 'string')) blockers.push('directory_snapshot_incomplete');
  return {status:blockers.length?'HOLD':'PREFLIGHT_OK', blockers, snapshots, note:'Read-only evidence only. PREFLIGHT_OK is not approval to rename; deployed worker version and non-index references require separate governed verification.'};
}
