import { ChannelType, PermissionFlagsBits } from 'discord.js';

// Source-backed, permission-gated Aquapedia messages for *existing* breeder forums.
const CATEGORY_NAME = '🔬・BREEDER RESEARCH';
const PUBLIC_CATEGORY_NAME = '📚・AQUAPEDIA';
const PUBLIC_FORUM_NAME = '🦐・shrimp-research';
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
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    // No literal IP addresses or local domain names in Discord's remote image loader.
    if (hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
      || hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname.endsWith('.local') || hostname.endsWith('.internal')) return null;
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
  if (!record || !['breeder', 'strain', 'competition'].includes(record.entityType) || !safeText(record.name)) {
    throw new Error('A breeder, strain or competition name and valid entityType are required');
  }
  const title = safeText(record.name, 160);
  const japanese = safeText(record.japaneseName, 100);
  const sources = (Array.isArray(record.sources) ? record.sources : [])
    .map((source) => httpsUrl(typeof source === 'string' ? source : source?.url))
    .filter(Boolean).slice(0, 5);
  const photos = photosAllowed(record.photos);
  if (record.entityType === 'competition') {
    if (record.organismGroup !== 'shrimp' || !sources.length) {
      throw new Error('Public shrimp competition records must have a reliable HTTPS source');
    }
    return {
      content: safeText(record.message || record.summary || title, 1900),
      embeds: [{
        title: 'COMPETITION • ' + title,
        description: 'Competition results credit entrants and exhibited stock, not automatically the original strain creator.',
        fields: [field('Research sources', sources.map((url, i) => `[${i + 1}](${url})`).join(' • '), 'Source unavailable')],
        footer: { text: `Aquapedia • ${safeText(record.id || title, 70)} • photos pending rights review` },
      }],
      allowedMentions: { parse: [] },
    };
  }
  // Discord embed values are limited to 1024 characters. Preserve every complete
  // source URL without truncating Markdown link targets in safeText().
  const sourceFields = [];
  let sourceChunk = '';
  for (const [index, url] of sources.entries()) {
    const citation = `[${index + 1}](${url})`;
    if (citation.length > 420) throw new Error('A research source URL exceeds the safe embed field limit');
    if (sourceChunk && sourceChunk.length + 3 + citation.length > 420) {
      sourceFields.push(field(sourceFields.length ? `Research sources (${sourceFields.length + 1})` : 'Research sources', sourceChunk));
      sourceChunk = '';
    }
    sourceChunk += (sourceChunk ? ' • ' : '') + citation;
  }
  if (sourceChunk) sourceFields.push(field(sourceFields.length ? `Research sources (${sourceFields.length + 1})` : 'Research sources', sourceChunk));
  if (!sourceFields.length) sourceFields.push(field('Research sources', '', 'Original-source citation pending'));
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
    ...sourceFields,
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

async function fetchCompleteArchivedThreads(forum) {
  const found = [];
  let before = null;
  // Bound enumeration, but never create a duplicate if the archive is incomplete.
  for (let pageNumber = 0; pageNumber < 25; pageNumber++) {
    const page = await forum.threads.fetchArchived(before
      ? { limit: 100, before }
      : { limit: 100 });
    const batch = [...page.threads.values()];
    found.push(...batch);
    if (!page.hasMore) return found;
    const oldest = batch.at(-1);
    const archiveDate = oldest?.archivedAt ?? (oldest?.archiveTimestamp ? new Date(oldest.archiveTimestamp) : null);
    if (!(archiveDate instanceof Date) || !Number.isFinite(archiveDate.getTime())) {
      throw new Error('Archived breeder forum pagination cursor not available');
    }
    if (before && archiveDate.getTime() >= before.getTime()) {
      throw new Error('Archived breeder forum pagination failed to advance');
    }
    before = archiveDate;
  }
  throw new Error('Archived breeder forum exceeded safe pagination limit');
}

function matchingThread(threads, record) {
  const name = record.entityType === 'breeder' ? `Breeder profile — ${safeText(record.name, 70)}` : record.entityType === 'competition' ? `Competition — ${safeText(record.name, 80)}` : safeText(record.name, 95);
  return { name, existing: threads.find((thread) => thread.name === name) ?? null };
}

// A breeder forum already exists under "🔬・BREEDER RESEARCH" in the live guild.
// Do NOT create competing breeder forums or guess which farm founded a strain.
export async function publishAquapediaCards(guild, result) {
  if (result?.status !== 'completed' || result.discordPublicationApproved !== true) {
    return { posted: 0, reason: 'review_or_completion_pending' };
  }
  const publicShrimp = result.publicShrimpResearch === true;
  if (publicShrimp && result.publicAudienceApproved !== true) {
    return { posted: 0, reason: 'public_audience_approval_pending' };
  }
  const cards = Array.isArray(result.cards) ? result.cards.slice(0, MAX_RECORDS) : [];
  if (!cards.length) return { posted: 0, reason: 'no_structured_cards' };
  const botId = guild?.client?.user?.id;
  if (!botId) return { posted: 0, reason: 'bot_identity_missing' };
  const channels = [...(guild?.channels?.cache?.values?.() ?? [])];
  const category = channels.find((c) => c.type === ChannelType.GuildCategory && c.name === (publicShrimp ? PUBLIC_CATEGORY_NAME : CATEGORY_NAME));
  if (!category) return { posted: 0, reason: 'research_category_not_found' };
  const forums = channels.filter((c) => c.type === ChannelType.GuildForum && c.parentId === category.id);
  if (!forums.length) return { posted: 0, reason: 'research_forums_not_found' };
  const publicForum = publicShrimp ? forums.find((c) => c.name === PUBLIC_FORUM_NAME) : null;
  if (publicShrimp) {
    const everyone = guild?.roles?.everyone;
    if (!publicForum || !everyone || !publicForum.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)) {
      return { posted: 0, reason: 'public_shrimp_forum_missing_or_not_public' };
    }
  }
  let posted = 0;
  let skipped = 0;
  let unverified = 0;
  const receipts = [];
  const destinations = new Map();
  const ordered = [...cards].sort((a, b) => Number(b.entityType === 'breeder') - Number(a.entityType === 'breeder'));
  for (const card of ordered) {
    const desired = forumSlug(card.breederForumName);
    const breeder = card.entityType === 'breeder' ? card.name : card.breederName;
    // Name-derived routing works only with an EXACT matching forum slug.
    // An unknown/contested breeder requires explicitly named "unknown-breeders".
    const fallback = forumSlug(breeder);
    const target = desired || fallback;
    if (publicShrimp && (card.organismGroup !== 'shrimp' || !['breeder', 'competition', 'strain'].includes(card.entityType)
      || !Array.isArray(card.sources) || !card.sources.some((source) => httpsUrl(typeof source === 'string' ? source : source?.url)))) {
      skipped += 1;
      continue;
    }
    const forum = publicShrimp ? publicForum : forums.find((c) => c.name === target);
    if (!forum || (!publicShrimp && !breeder && target !== 'unknown-breeders')) { skipped += 1; continue; }
    let payload;
    try {
      payload = buildAquapediaPost(card);
    } catch {
      skipped += 1;
      continue;
    }
    let threads;
    try {
      const active = await forum.threads.fetchActive();
      const archived = await fetchCompleteArchivedThreads(forum);
      threads = [...active.threads.values(), ...archived];
    } catch {
      // Do not create or append when existing discussions cannot be enumerated.
      skipped += 1;
      break;
    }
    const { name, existing } = matchingThread(threads, card);
    let thread;
    let priorMessageId = null;
    if (existing) {
      thread = existing;
      if (typeof thread.messages?.fetch !== 'function') { skipped += 1; continue; }
      const history = await thread.messages.fetch({ limit: 100 });
      const recordId = safeText(card.id || card.name, 70);
      const previous = [...history.values()].find((message) => message.author?.id === botId
        && message.embeds?.some((embed) => embed.footer?.text?.startsWith(`Aquapedia • ${recordId} •`))
        && typeof message.edit === 'function');
      if (!previous) { skipped += 1; continue; }
      if (thread.archived) await thread.setArchived(false, 'Update approved Aquapedia evidence');
      await previous.edit(payload);
      priorMessageId = previous.id;
    } else {
      thread = await forum.threads.create({ name, message: payload, reason: 'Approved Aquapedia breeder or strain dossier' });
    }
    let readback = null;
    try {
      readback = priorMessageId
        ? await thread.messages.fetch(priorMessageId)
        : (typeof thread.fetchStarterMessage === 'function' ? await thread.fetchStarterMessage() : null);
    } catch {
      // The Discord write may have succeeded. Stop to avoid duplicates on a retry.
      unverified += 1;
      break;
    }
    const recordId = safeText(card.id || card.name, 70);
    const verified = Boolean(readback?.id && readback.author?.id === botId
      && readback.embeds?.some((embed) => embed.footer?.text?.startsWith(`Aquapedia • ${recordId} •`)));
    if (!verified) { unverified += 1; break; }
    receipts.push({ recordId, threadId: thread.id, messageId: readback.id, verified: true });
    destinations.set(forum.name + ':' + name, thread.id);
    posted += 1;
  }
  return {
    posted,
    skipped,
    unverified,
    receipts,
    reason: unverified ? 'message_readback_unverified' : posted ? 'verified_in_existing_breeder_forums' : 'no_matching_authorized_breeder_forum',
    threadIds: [...destinations.values()],
  };
}

export async function persistVerifiedReceipts(store, jobId, publication) {
  const receipts = (Array.isArray(publication?.receipts) ? publication.receipts : [])
    .filter((entry) => entry?.verified === true && entry.recordId && entry.threadId && entry.messageId)
    .map(({ recordId, threadId, messageId }) => ({ recordId, threadId, messageId, verified: true }));
  if (!receipts.length) return { recorded: 0, reason: 'no_verified_receipts' };
  if (!jobId || typeof store?.recordResearchJob !== 'function') {
    throw new Error('A verified research job and durable store are required for publication receipts');
  }
  await store.recordResearchJob({
    id: String(jobId),
    discordPublicationReceipts: receipts,
    discordPublishedCount: receipts.length,
    discordUnverifiedCount: Math.max(0, Number(publication.unverified) || 0),
    discordVerifiedAt: new Date().toISOString(),
  });
  return { recorded: receipts.length, reason: 'receipts_persisted' };
}
