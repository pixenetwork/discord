// Pure, credential-free adapter. Converts the existing Aquapedia research manifests
// into one public forum batch; it never fetches, authorizes, or posts messages.
function goodSource(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password &&
      !host.startsWith('[') && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) &&
      host !== 'localhost' && !host.endsWith('.localhost') &&
      !host.endsWith('.local') && !host.endsWith('.internal');
  } catch { return false; }
}

export function prepareShrimpPublicBatch({
  breederManifest, contestManifest, editorialApproved = false, publicAudienceApproved = false,
} = {}) {
  const breeders = breederManifest?.cards;
  const records = contestManifest?.records;
  if (!Array.isArray(breeders) || breeders.length !== 14 || !Array.isArray(records)) {
    throw new Error('Expected the vetted 14-breeder source and competition highlight records');
  }
  const contests = records.filter((record) => record?.kind === 'competition');
  if (contests.length !== 8) throw new Error('Exactly eight competition records are required');
  const cards = [];
  const ids = new Set();
  function push(card) {
    if (!card?.id || !card.name || ids.has(card.id)) throw new Error('Missing or duplicate shrimp research ID');
    ids.add(card.id);
    if (!Array.isArray(card.photos) || card.photos.length !== 0) {
      throw new Error('Public forum posts must not import unreviewed shrimp photos');
    }
    if (!Array.isArray(card.sources) || !card.sources.some(goodSource) || !card.sources.every(goodSource)) {
      throw new Error('Every shrimp record requires a valid HTTPS research source');
    }
    cards.push(card);
  }

  for (const breeder of breeders) {
    if (breeder?.entityType !== 'breeder' || breeder.organismGroup !== 'shrimp') {
      throw new Error('Breeder research identity or organism group mismatch');
    }
    if (!Array.isArray(breeder.photos) || breeder.photos.length) {
      throw new Error('Unreviewed breeder photos must not enter the public batch');
    }
    push({ ...breeder, sources: [...(breeder.sources || [])], photos: [] });
  }
  for (const event of contests) {
    if (!event.title || !event.message || event.message.length > 1900) {
      throw new Error('Competition name/message is missing or too long for Discord');
    }
    push({
      id: event.id,
      name: event.title,
      entityType: 'competition',
      organismGroup: 'shrimp',
      message: event.message,
      summary: 'Historical contest information; no original-strain-creator inference.',
      sources: [...(event.links || [])],
      photos: [],
    });
  }

  const approved = editorialApproved === true && publicAudienceApproved === true;
  return {
    status: approved ? 'completed' : 'review_pending',
    discordPublicationApproved: approved,
    publicAudienceApproved: approved,
    publicShrimpResearch: true,
    cards,
  };
}
