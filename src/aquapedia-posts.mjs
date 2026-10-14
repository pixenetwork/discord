// Research-only Discord publisher. Never treats a public image URL as reuse permission.
const FORUM_NAME = '🧬・breeder-strains';
const ALLOWED_RIGHTS = new Set(['owner_owned', 'licensed', 'permission_granted', 'public_domain', 'cc0']);
const MAX_RECORDS = 30;

function safeText(value, max = 1000) {
  return String(value ?? '').trim().replace(/@(everyone|here)/gi, '@\u200b$1').slice(0, max);
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function photosAllowed(photos) {
  return (Array.isArray(photos) ? photos : [])
    .filter((item) => item && ALLOWED_RIGHTS.has(String(item.reuseStatus)) && httpsUrl(item.url) && safeText(item.credit))
    .slice(0, 3)
    .map((item) => ({ url: httpsUrl(item.url), credit: safeText(item.credit, 180), view: safeText(item.view, 50) }));
}

function field(name, value, empty = 'Not established') {
  return { name, value: safeText(value || empty, 950), inline: false };
}

// Stable, reviewable message payload; Discord renders every approved photo inline.
export function buildAquapediaPost(record) {
  if (!record || !['breeder', 'strain'].includes(record.entityType) || !safeText(record.name)) {
    throw new Error('A breeder/strain name and valid entityType are required');
  }
  const title = safeText(record.name, 160);
  const japanese = safeText(record.japaneseName, 100);
  const sources = (Array.isArray(record.sources) ? record.sources : [])
    .map((source) => httpsUrl(typeof source === 'string' ? source : source?.url))
    .filter(Boolean)
    .slice(0, 5);
  const images = photosAllowed(record.photos);
  const fields = [
    field('Breeder / creator', record.breederName ?? (record.entityType === 'breeder' ? record.name : null)),
    field('Description & identifying traits', record.description ?? record.phenotype),
    field('Origins / development history', record.history),
    field('Lineage / parent crosses', record.lineage, 'Not independently established'),
    field('Breeding & grade', record.breeding),
    field('Care notes', record.care, 'General medaka care applies; strain-specific parameters not established'),
    field('Evidence confidence', record.confidence ?? 'Unverified'),
    field('Research sources', sources.map((url, i) => `[${i + 1}](${url})`).join(' • '), 'Original-source citation pending'),
  ];
  const embed = {
    title: (record.entityType === 'breeder' ? 'BREEDER • ' : 'STRAIN • ') + title,
    description: japanese ? `Japanese: ${japanese}\n${safeText(record.summary, 700)}` : safeText(record.summary || title, 700),
    fields,
    footer: { text: `Aquapedia • ${safeText(record.id || title, 70)} • ${images.length ? 'licensed imagery' : 'photos pending rights review'}` },
  };
  if (images.length) embed.image = { url: images[0].url };
  const extras = images.slice(1).map((photo) => ({
    image: { url: photo.url },
    footer: { text: `Photo: ${photo.credit}${photo.view ? ' • ' + photo.view : ''}` },
  }));
  // Crediting the first image is equally important.
  if (images.length) embed.fields.push(field('Photo credit', images[0].credit + (images[0].view ? ' • ' + images[0].view : '')));
  return { content: `🧬 **${title}** — ${record.entityType === 'breeder' ? 'breeder profile' : 'strain dossier'}${images.length ? '' : '\n📷 Original specimen images pending documented reuse permission.'}`, embeds: [embed, ...extras], allowedMentions: { parse: [] } };
}

function threadFor(threads, name) {
  return [...(threads?.values?.() ?? [])].find((thread) => thread.name === name) ?? null;
}

// Only approved evidence packets go to the private breeder forum.
// Caller must not silently treat queueing or GitHub research saves as publication.
export async function publishAquapediaCards(guild, result) {
  if (!result || result.status !== 'completed' || result.discordPublicationApproved !== true) {
    return { posted: 0, reason: 'review_or_completion_pending' };
  }
  const cards = Array.isArray(result.cards) ? result.cards.slice(0, MAX_RECORDS) : [];
  if (!cards.length) return { posted: 0, reason: 'no_structured_cards' };
  const forum = guild?.channels?.cache?.find?.((channel) => channel.name === FORUM_NAME && channel.type === 15);
  if (!forum) return { posted: 0, reason: 'breeder_forum_not_found' };

  const active = await forum.threads.fetchActive();
  const archived = await forum.threads.fetchArchived({ limit: 100 });
  const known = [...active.threads.values(), ...archived.threads.values()];
  let posted = 0;
  const destinations = new Map();

  // Breeder profile is posted first where supplied; each strain follows beneath its breeder thread.
  const ordered = [...cards].sort((a, b) => Number(b.entityType === 'breeder') - Number(a.entityType === 'breeder'));
  for (const card of ordered) {
    const breederName = safeText(card.entityType === 'breeder' ? card.name : card.breederName, 100);
    if (!breederName) continue; // No guesswork about who bred a line.
    const payload = buildAquapediaPost(card);
    let thread = destinations.get(breederName) ?? threadFor(known, breederName);
    if (!thread) {
      thread = await forum.threads.create({ name: breederName, message: payload, reason: 'Approved Aquapedia breeder/strain dossier' });
      known.push(thread);
    } else {
      if (thread.archived) await thread.setArchived(false, 'Append approved Aquapedia research');
      await thread.send(payload);
    }
    destinations.set(breederName, thread);
    posted += 1;
  }
  return { posted, reason: posted ? 'published' : 'missing_breeder_attribution', threadIds: [...destinations.values()].map((t) => t.id) };
}
