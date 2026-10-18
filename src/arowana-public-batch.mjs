// Credential-free adapter: one canonical Aquapedia publication batch for the
// existing permission-gated Discord forum publisher. Never posts by itself.
function validPublicUrl(value, website = false) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash
        || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
        || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')
        || host.startsWith('[')) return false;
    if (website) return host === 'aquapedia.app' && /^\/arowanapedia\/[a-z0-9-]+\/$/.test(url.pathname);
    return true;
  } catch { return false; }
}
export function prepareArowanaPublicBatch({
  manifest, editorialApproved = false, publicAudienceApproved = false,
} = {}) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.cards) || manifest.cards.length !== 10) {
    throw new Error('Expected ten canonical Arowanapedia source cards (version 1)');
  }
  const ids = new Set(), paths = new Set();
  const cards = manifest.cards.map((raw) => {
    if (!raw || raw.organismGroup !== 'arowana'
        || !['species', 'research'].includes(raw.entityType)
        || !/^[A-Za-z0-9._:-]{1,70}$/.test(String(raw.id ?? ''))
        || ids.has(raw.id) || !String(raw.name ?? '').trim()
        || !String(raw.summary ?? '').trim()
        || !validPublicUrl(raw.websiteUrl, true) || paths.has(raw.websiteUrl)
        || !Array.isArray(raw.sources) || !raw.sources.length
        || !raw.sources.every((source) => validPublicUrl(source))
        || !Array.isArray(raw.photos) || raw.photos.length) {
      throw new Error('Invalid Arowanapedia identity, source, link, or image rights');
    }
    ids.add(raw.id);
    paths.add(raw.websiteUrl);
    return { ...raw, sources: [...raw.sources], photos: [] };
  });
  if (cards.filter((card) => card.entityType === 'species').length !== 7
      || cards.filter((card) => card.entityType === 'research').length !== 3) {
    throw new Error('Expected seven species/related-lineage and three research threads');
  }
  const approved = editorialApproved === true && publicAudienceApproved === true;
  return {
    status: approved ? 'completed' : 'review_pending',
    discordPublicationApproved: approved,
    publicAudienceApproved: approved,
    publicArowanaResearch: true,
    cards,
  };
}
