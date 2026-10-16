// Source-backed, permission-gated Aquapedia messages for *existing* breeder forums.
const CATEGORY_NAME = '🔬・BREEDER RESEARCH';
const ALLOWED_RIGHTS = new Set(['owner_owned', 'licensed', 'permission_granted', 'public_domain', 'cc0']);
const MAX_RECORDS = 30;

function safeText(value, max = 1000) {
  return String(value ?? '').trim().replace(/@(everyone|here)/gi, '@\u200b$1').slice(0, max);
}

function forumSlug(value) {
  return String(value ?? '').trim().normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')
      || /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(hostname)) return null;
    return url.href;
  } catch { return null; }
}

function photosAllowed(photos) {
  return (Array.isArray(photos) ? photos : [])
    .filter((item) => item && ALLOWED_RIGHTS.has(String(item.reuseStatus)) && httpsUrl(item.url) && safeText(item.credit))
    .slice(0, 3)
    .map((item) => ({ url: httpsUrl(item.url), credit: safeText(item.credit, 180), view: safeText(item.view, 50) }));
}

function field(name, value, empty = 'Not established') {
  return { name, value: safeText(value || empty, 430), inline: false };
}

export function buildAquapediaPost(record) {
  if (!record || !['breeder', 'strain'].includes(record.entityType) || !safeText(record.name)) {
    throw new Error('A breeder/strain name and valid entityType are required');
  }
  const title = safeText(record.name, 160);
  const japanese = safeText(record.japaneseName, 100);
  const sources = (Array.isArray(record.sources) ? record.sources : [])
    .map((source) => httpsUrl(typeof source === 'string' ? source : source?.url))
    .filter(Boolean).slice(0, 5);
  const photos = photosAllowed(record.photos);
  const fields = [
    field('Breeder / creator', record.breederName ?? (record.entityType === 'breeder' ? record.name : null)),
    field('Description & identifying traits', record.description ?? record.phenotype),
    field('Origins / development history', record.history),
    field('Lineage / parent crosses', record.lineage, 'Not independently established'),
    field('Breeding & grade', record.breeding),
    field('Care notes', record.care, /shrimp|caridina|neocaridina/i.test([record.organismGroup, record.taxon, record.species].join(' '))
      ? 'Shrimp care depends on genus and lineage; strain-specific parameters are not established'
      : 'General medaka care applies; strain-specific parameters not established'),
    field('Evidence confidence', record.confidence ?? 'Unverified'),
    field('Research sources', sources.map((url, i) => `[${i + 1}](${url})`).join(' • '), 'Original-source citation pending'),
  ];
  const embed = {
    title: (record.entityType === 'breeder' ? 'BREEDER • ' : 'STRAIN • ') + title,
    description: japanese ? `Japanese: ${japanese}\n${safeText(record.summary, 450)}` : safeText(record.summary || title, 450),
    fields,
    footer: { text: `Aquapedia • ${safeText(record.id || title, 70)} • ${photos.length ? 'licensed imagery' : 'photos pending rights review'}` },
  };
  if (photos.length) {
    embed.image = { url: photos[0].url };
    embed.fields.push(field('Photo credit', photos[0].credit + (photos[0].view ? ' • ' + photos[0].view : '')));
  }
  const extraEmbeds = photos.slice(1).map((photo) => ({
    image: { url: photo.url },
    footer: { text: `Photo: ${photo.credit}${photo.view ? ' • ' + photo.view : ''}` },
  }));
  return {
    content: `🧬 **${title}** — ${record.entityType === 'breeder' ? 'breeder profile' : 'strain dossier'}${photos.length ? '' : '\n📷 Original specimen images pending documented reuse permission.'}`,
    embeds: [embed, ...extraEmbeds],
    allowedMentions: { parse: [] },
  };
}

function matchingThread(threads, record) {
  const name = record.entityType === 'breeder' ? `Breeder profile — ${safeText(record.name, 70)}` : safeText(record.name, 95);
  return { name, existing: threads.find((thread) => thread.name === name) ?? null };
}

// A breeder forum already exists under "🔬・BREEDER RESEARCH" in the live guild.
// Do NOT create competing breeder forums or guess which farm founded a strain.
export async function publishAquapediaCards(guild, result) {
  if (result?.status !== 'completed' || result.discordPublicationApproved !== true) {
    return { posted: 0, reason: 'review_or_completion_pending' };
  }
  const cards = Array.isArray(result.cards) ? result.cards.slice(0, MAX_RECORDS) : [];
  if (!cards.length) return { posted: 0, reason: 'no_structured_cards' };
  const channels = [...(guild?.channels?.cache?.values?.() ?? [])];
  const category = channels.find((c) => c.type === 4 && c.name === CATEGORY_NAME);
  if (!category) return { posted: 0, reason: 'existing_breeder_category_not_found' };
  const forums = channels.filter((c) => c.type === 15 && c.parentId === category.id);
  if (!forums.length) return { posted: 0, reason: 'existing_breeder_forums_not_found' };
  let posted = 0;
  let skipped = 0;
  const destinations = new Map();
  const ordered = [...cards].sort((a, b) => Number(b.entityType === 'breeder') - Number(a.entityType === 'breeder'));
  for (const card of ordered) {
    const desired = forumSlug(card.breederForumName);
    const breeder = card.entityType === 'breeder' ? card.name : card.breederName;
    // Name-derived routing works only with an EXACT matching forum slug.
    // An unknown/contested breeder requires explicitly named "unknown-breeders".
    const fallback = forumSlug(breeder);
    const target = desired || fallback;
    const forum = forums.find((c) => c.name === target);
    if (!forum || (!breeder && target !== 'unknown-breeders')) { skipped += 1; continue; }
    const payload = buildAquapediaPost(card);
    const active = await forum.threads.fetchActive();
    const archived = await forum.threads.fetchArchived({ limit: 100 });
    const threads = [...active.threads.values(), ...archived.threads.values()];
    const { name, existing } = matchingThread(threads, card);
    let thread;
    if (existing) {
      thread = existing;
      if (thread.archived) await thread.setArchived(false, 'Append approved Aquapedia evidence');
      await thread.send(payload);
    } else {
      thread = await forum.threads.create({ name, message: payload, reason: 'Approved Aquapedia breeder or strain dossier' });
    }
    destinations.set(forum.name + ':' + name, thread.id);
    posted += 1;
  }
  return {
    posted,
    skipped,
    reason: posted ? 'published_to_existing_breeder_forums' : 'no_matching_authorized_breeder_forum',
    threadIds: [...destinations.values()],
  };
}
