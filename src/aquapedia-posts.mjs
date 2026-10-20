import { probePublicThreadCapacity } from './thread-capacity.mjs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

// Source-backed, permission-gated Aquapedia messages for *existing* breeder forums.
const CATEGORY_NAME = '🔬・BREEDER RESEARCH';
const PUBLIC_CATEGORY_NAME = '📚・AQUAPEDIA';
const PUBLIC_FORUM_NAME = '🦐・shrimp-research';
const PUBLIC_AROWANA_FORUM_NAME = '🐉・arowana-research';
const PUBLIC_GUPPY_FORUM_NAME = '🐠・guppy-research';
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

function sourceCitationFields(sources) {
  const values = [];
  let chunk = '';
  for (const [i, url] of sources.entries()) {
    const citation = '[' + (i + 1) + '](' + url + ')';
    if (citation.length > 420) throw new Error('A research source URL exceeds the safe embed field limit');
    if (chunk && chunk.length + 3 + citation.length > 420) {
      values.push(field(values.length ? 'Research sources (' + (values.length + 1) + ')' : 'Research sources', chunk));
      chunk = '';
    }
    chunk += (chunk ? ' • ' : '') + citation;
  }
  if (chunk) values.push(field(values.length ? 'Research sources (' + (values.length + 1) + ')' : 'Research sources', chunk));
  if (!values.length) values.push(field('Research sources', '', 'Original-source citation pending'));
  return values;
}

function ensureDiscordEmbedLimits(embeds) {
  let total = 0;
  for (const embed of embeds) {
    total += String(embed.title || '').length + String(embed.description || '').length
      + String(embed.footer?.text || '').length + String(embed.author?.name || '').length;
    for (const item of embed.fields || []) {
      if (item.value.length > 1024) throw new Error('Discord embed field limit exceeded');
      total += item.name.length + item.value.length;
    }
  }
  if (total > 6000) throw new Error('Discord aggregate embed 6000-character limit exceeded');
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
  if (!record || !['breeder', 'strain', 'competition', 'species', 'research'].includes(record.entityType) || !safeText(record.name)) {
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
    const embeds = [{
      title: 'COMPETITION • ' + title,
      description: 'Competition results credit entrants and exhibited stock, not automatically the original strain creator.',
      fields: sourceCitationFields(sources),
      footer: { text: 'Aquapedia • ' + safeText(record.id || title, 70) + ' • photos pending rights review' },
    }];
    ensureDiscordEmbedLimits(embeds);
    return {
      content: safeText(record.message || record.summary || title, 1900),
      embeds,
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
  const fields = ['species', 'research'].includes(record.entityType) ? [
    field('Identity / scope', record.description ?? record.phenotype),
    field('Origins / geographical range', record.history),
    field('Genetics / interpretation', record.lineage, 'Not independently established'),
    field('Biology, welfare and conservation', record.care),
    field('Evidence confidence', record.confidence ?? 'Evidence under review'),
    ...sourceFields,
  ] : [
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
    title: (record.entityType === 'breeder' ? 'BREEDER • ' : record.entityType === 'species' ? 'SPECIES • ' : record.entityType === 'research' ? 'RESEARCH • ' : 'STRAIN • ') + title,
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
  const embeds = [embed, ...extraEmbeds];
  ensureDiscordEmbedLimits(embeds);
  return {
    content: `🧬 **${title}** — ${record.entityType === 'breeder' ? 'breeder profile' : record.entityType === 'species' ? 'species dossier' : record.entityType === 'research' ? 'research guide' : 'strain dossier'}${photos.length ? '' : '\n📷 Original specimen images pending documented reuse permission.'}${record.organismGroup === 'arowana' && httpsUrl(record.websiteUrl) ? '\nFull research: ' + httpsUrl(record.websiteUrl) : ''}`,
    embeds,
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

function matchingThread(threads, record, publicResearch = false) {
  let name;
  if (publicResearch) {
    // Distinguish two strains with the same display name without exceeding
    // Discord's 100-character thread-name limit. IDs are prevalidated.
    const idTag = '[' + record.id + ']';
    const prefix = record.entityType === 'breeder' ? 'Breeder — '
      : record.entityType === 'competition' ? 'Competition — '
        : record.entityType === 'species' ? 'Species — '
          : record.entityType === 'research' ? 'Research — ' : 'Strain — ';
    const spaceForName = Math.max(0, 100 - prefix.length - idTag.length - 1);
    name = prefix + safeText(record.name, spaceForName) + ' ' + idTag;
  } else {
    name = record.entityType === 'breeder'
      ? 'Breeder profile — ' + safeText(record.name, 70)
      : record.entityType === 'competition' ? 'Competition — ' + safeText(record.name, 80)
        : safeText(record.name, 95);
  }
  return { name, existing: threads.find((thread) => thread.name === name) ?? null };
}

// A breeder forum already exists under "🔬・BREEDER RESEARCH" in the live guild.
// Do NOT create competing breeder forums or guess which farm founded a strain.
export async function publishAquapediaCards(guild, result) {
  if (result?.status !== 'completed' || result.discordPublicationApproved !== true) {
    return { posted: 0, reason: 'review_or_completion_pending' };
  }
  const publicShrimp = result.publicShrimpResearch === true;
  const publicArowana = result.publicArowanaResearch === true;
  const publicGuppy = result.publicGuppyResearch === true;
  if ([publicShrimp, publicArowana, publicGuppy].filter(Boolean).length > 1) return { posted: 0, reason: 'conflicting_public_destinations' };
  const publicResearch = publicShrimp || publicArowana || publicGuppy;
  if (publicResearch && result.publicAudienceApproved !== true) {
    return { posted: 0, reason: 'public_audience_approval_pending' };
  }
  const cards = Array.isArray(result.cards) ? result.cards.slice(0, MAX_RECORDS) : [];
  if (!cards.length) return { posted: 0, reason: 'no_structured_cards' };
  if (publicResearch) {
    const ids = new Set();
    for (const card of cards) {
      const id = card?.id;
      if (!/^[A-Za-z0-9._:-]{1,70}$/.test(String(id ?? '')) || ids.has(id)) {
        return { posted: 0, reason: 'invalid_or_duplicate_public_record_id' };
      }
      ids.add(id);
    }
  }
  const botId = guild?.client?.user?.id;
  if (!botId) return { posted: 0, reason: 'bot_identity_missing' };
  const channels = [...(guild?.channels?.cache?.values?.() ?? [])];
  const category = channels.find((c) => c.type === ChannelType.GuildCategory && c.name === (publicResearch ? PUBLIC_CATEGORY_NAME : CATEGORY_NAME));
  if (!category) return { posted: 0, reason: 'research_category_not_found' };
  const forums = channels.filter((c) => c.type === ChannelType.GuildForum && c.parentId === category.id);
  if (!forums.length) return { posted: 0, reason: 'research_forums_not_found' };
  const publicForum = publicResearch ? forums.find((c) => c.name === (publicShrimp ? PUBLIC_FORUM_NAME : publicArowana ? PUBLIC_AROWANA_FORUM_NAME : PUBLIC_GUPPY_FORUM_NAME)) : null;
  if (publicResearch) {
    const everyone = guild?.roles?.everyone;
    if (!publicForum || !everyone || (!publicForum.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
      || !publicForum.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory))) {
      return { posted: 0, reason: publicShrimp ? 'public_shrimp_forum_missing_or_not_public' : publicArowana ? 'public_arowana_forum_missing_or_not_public' : 'public_guppy_forum_missing_or_not_public' };
    }
  }
  let posted = 0;
  let skipped = 0;
  let unverified = 0;
  let capacityBlocked = false;
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
    if (publicResearch && (card.organismGroup !== (publicShrimp ? 'shrimp' : publicArowana ? 'arowana' : 'guppy')
      || !(publicShrimp ? ['breeder', 'competition', 'strain'] : ['species', 'research', 'strain']).includes(card.entityType)
      || ((publicArowana || publicGuppy) && (!Array.isArray(card.photos) || card.photos.length !== 0))
      || !Array.isArray(card.sources) || !card.sources.some((source) => httpsUrl(typeof source === 'string' ? source : source?.url))
      || ((publicArowana || publicGuppy) && !new RegExp(publicArowana ? '^https://aquapedia\\.app/arowanapedia/[a-z0-9-]+/)) {
      skipped += 1;
      continue;
    }
    const forum = publicResearch ? publicForum : forums.find((c) => c.name === target);
    if (!forum || (!publicResearch && !breeder && target !== 'unknown-breeders')) { skipped += 1; continue; }
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
    const { name, existing } = matchingThread(threads, card, publicResearch);
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
      if (thread.archived) {
        // Reopening an archived thread also consumes a guild-wide active slot.
        if (publicResearch) {
          const capacity = await probePublicThreadCapacity(guild);
          if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
        }
        await thread.setArchived(false, 'Update approved Aquapedia evidence');
      }
      await previous.edit(payload);
      priorMessageId = previous.id;
    } else {
      if (publicResearch) {
        // The active-thread ceiling is GUILD-wide, not specific to this forum.
        const capacity = await probePublicThreadCapacity(guild);
        if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
      }
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
    reason: unverified ? 'message_readback_unverified' : capacityBlocked ? 'discord_thread_capacity_guard' : posted ? 'verified_in_existing_breeder_forums' : 'no_matching_authorized_breeder_forum',
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
 : '^https://aquapedia\\.app/guppypedia/(?:entries/gup-[0-9]{3}/|care/|strains/|genetics/|breeding/|food/|health/|endlers/))) {
      skipped += 1;
      continue;
    }
    const forum = publicResearch ? publicForum : forums.find((c) => c.name === target);
    if (!forum || (!publicResearch && !breeder && target !== 'unknown-breeders')) { skipped += 1; continue; }
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
    const { name, existing } = matchingThread(threads, card, publicResearch);
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
      if (thread.archived) {
        // Reopening an archived thread also consumes a guild-wide active slot.
        if (publicResearch) {
          const capacity = await probePublicThreadCapacity(guild);
          if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
        }
        await thread.setArchived(false, 'Update approved Aquapedia evidence');
      }
      await previous.edit(payload);
      priorMessageId = previous.id;
    } else {
      if (publicResearch) {
        // The active-thread ceiling is GUILD-wide, not specific to this forum.
        const capacity = await probePublicThreadCapacity(guild);
        if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
      }
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
    reason: unverified ? 'message_readback_unverified' : capacityBlocked ? 'discord_thread_capacity_guard' : posted ? 'verified_in_existing_breeder_forums' : 'no_matching_authorized_breeder_forum',
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
).test(String(card.websiteUrl ?? ''))))) {
      skipped += 1;
      continue;
    }
    const forum = publicResearch ? publicForum : forums.find((c) => c.name === target);
    if (!forum || (!publicResearch && !breeder && target !== 'unknown-breeders')) { skipped += 1; continue; }
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
    const { name, existing } = matchingThread(threads, card, publicResearch);
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
      if (thread.archived) {
        // Reopening an archived thread also consumes a guild-wide active slot.
        if (publicResearch) {
          const capacity = await probePublicThreadCapacity(guild);
          if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
        }
        await thread.setArchived(false, 'Update approved Aquapedia evidence');
      }
      await previous.edit(payload);
      priorMessageId = previous.id;
    } else {
      if (publicResearch) {
        // The active-thread ceiling is GUILD-wide, not specific to this forum.
        const capacity = await probePublicThreadCapacity(guild);
        if (!capacity.allowed) { capacityBlocked = true; skipped += 1; break; }
      }
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
    reason: unverified ? 'message_readback_unverified' : capacityBlocked ? 'discord_thread_capacity_guard' : posted ? 'verified_in_existing_breeder_forums' : 'no_matching_authorized_breeder_forum',
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
