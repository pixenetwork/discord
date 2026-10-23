// Public breeder evidence publisher for existing Aquapedia medaka/shrimp forums.
// Requires explicit owner approval and an exact per-record route. Never guesses
// category/thread IDs, recopies breeder photos, or overwrites other authors.
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { buildAquapediaPost } from './aquapedia-posts.mjs';
import { probePublicThreadCapacity } from './thread-capacity.mjs';

const MAX_CARDS = 4;
const ALLOWED_FORUMS = Object.freeze({
  medaka: 'medaka-research',
  shrimp: 'shrimp-research',
});

const safe = (s) => String(s ?? '').trim();
const normalized = (s) => safe(s).normalize('NFKC').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const suffix = (s) => normalized(s).replace(/^.*? /, '');
const recordMarker = (id) => '[AQ-BREEDER:' + id + ']';
const blocked = (reason, receipts = [], skipped = 0) => ({
  posted: receipts.length, receipts, skipped, reason,
});

function validRoute(card, route) {
  const pinned = VERIFIED_BREEDER_ROUTES[card.id];
  return Boolean(route && pinned
    && route.forum === pinned.forum
    && route.mode === pinned.mode
    && route.breederKey === pinned.breederKey
    && route.forum === ALLOWED_FORUMS[card.organismGroup]
    && ['existing_only', 'create_if_missing'].includes(route.mode)
    && normalized(card.breederName).includes(normalized(route.breederKey))
    && safe(route.breederKey).length >= 4
    && /^[a-zA-Z0-9-]{6,70}$/.test(card.id)
    && normalized(route.breederKey) !== 'breeder'
    && card.entityType === 'breeder'
    && Array.isArray(card.photos) && card.photos.length === 0
    && Array.isArray(card.sources) && card.sources.length > 0
    && card.sources.every((x) => {
      try {
        const u = new URL(x);
        return u.protocol === 'https:' && !/(^|\.)reddit\.com$/i.test(u.hostname)
          && !u.username && !u.password;
      } catch { return false; }
    }));
}

function visiblePublicForum(guild, card, route) {
  const all = [...(guild?.channels?.cache?.values?.() ?? [])];
  const candidates = all.filter((x) => x.type === ChannelType.GuildForum
    && normalized(x.name) === route.forum.replace(/-/g, ' '));
  if (candidates.length !== 1) return null;
  const forum = candidates[0];
  const parent = all.find((x) => x.id === forum.parentId && x.type === ChannelType.GuildCategory);
  const pname = normalized(parent?.name);
  if (!pname.startsWith('aquapedia') || pname.includes('research') || pname.includes('private')) return null;
  const everyone = guild?.roles?.everyone;
  const permissions = everyone && forum.permissionsFor?.(everyone);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)
    || !permissions?.has(PermissionFlagsBits.ReadMessageHistory)) return null;
  // The current bot must have read and create/reply permissions. No role guessing.
  const bot = guild?.client?.user;
  const botPermissions = bot && forum.permissionsFor?.(bot);
  if (!botPermissions?.has(PermissionFlagsBits.ViewChannel)
    || !botPermissions?.has(PermissionFlagsBits.ReadMessageHistory)
    || !botPermissions?.has(PermissionFlagsBits.SendMessagesInThreads)) return null;
  return forum;
}

async function completeThreads(forum) {
  const active = await forum.threads.fetchActive();
  const threads = [...active.threads.values()];
  let before = null;
  for (let i = 0; i < 25; i++) {
    const page = await forum.threads.fetchArchived(before ? { before, limit: 100 } : { limit: 100 });
    const batch = [...page.threads.values()];
    threads.push(...batch);
    if (!page.hasMore) {
      const unique = new Map(threads.map((t) => [t.id, t]));
      return [...unique.values()];
    }
    const oldest = batch.at(-1)?.archivedAt;
    if (!(oldest instanceof Date) || !Number.isFinite(oldest.getTime())
      || (before && oldest.getTime() >= before.getTime())) {
      throw new Error('incomplete_archived_thread_enumeration');
    }
    before = oldest;
  }
  throw new Error('archived_thread_limit_exceeded');
}

function findExisting(threads, card, route) {
  const key = normalized(route.breederKey);
  const matches = threads.filter((t) => {
    const n = normalized(t.name);
    // Require the breeder's actual title to lead the thread name. A passing
    // mention in a different breeder's title is NOT an address to publish to.
    const subject = n.replace(/^breeder (?:profile )?/, '');
    if (subject === n) return false;
    return subject === key || subject.startsWith(key + ' ');
  });
  return matches;
}

async function fullMessageHistory(thread) {
  if (typeof thread.messages?.fetch !== 'function') throw Error('thread_history_not_readable');
  let before = null;
  const found = [];
  for (let page = 0; page < 10; page++) {
    const messages = await thread.messages.fetch(before ? { limit: 100, before } : { limit: 100 });
    const items = [...messages.values()];
    found.push(...items);
    if (items.length < 100) return found;
    const last = items.at(-1);
    if (!last?.id || last.id === before) throw Error('message_history_cursor_missing');
    before = last.id;
  }
  throw Error('message_history_limit_exceeded');
}

function verifiedBotReply(message, botId, id) {
  return Boolean(message?.id && message?.author?.id === botId
    && typeof message.content === 'string'
    && message.content.includes(recordMarker(id))
    && message.embeds?.some((e) => safe(e.footer?.text).startsWith('Aquapedia • ' + id + ' •')));
}

// The batch is intentionally review-closed in the research repo. A separately
// authenticated owner action must make ALL three approvals true at dispatch time.
export async function publishVerifiedBreederPublicBatch(guild, request) {
  if (request?.status !== 'completed' || request.ownerApproved !== true
    || request.discordPublicationApproved !== true || request.publicAudienceApproved !== true) {
    return blocked('owner_and_publication_approval_required');
  }
  const cards = request.cards;
  const routes = request.routes;
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > MAX_CARDS
    || !routes || !guild?.client?.user?.id) return blocked('invalid_batch_or_bot_identity');
  if (new Set(cards.map((c) => c.id)).size !== cards.length
    || cards.some((c) => !validRoute(c, routes[c.id]))) return blocked('route_source_or_rights_invalid');

  const receipts = [];
  let skipped = 0;
  for (const card of cards) {
    const route = routes[card.id];
    const forum = visiblePublicForum(guild, card, route);
    if (!forum) return blocked('target_forum_not_verified_public_and_writable', receipts, skipped);
    let threads;
    try { threads = await completeThreads(forum); }
    catch { return blocked('thread_enumeration_incomplete', receipts, skipped); }
    const matches = findExisting(threads, card, route);
    if (matches.length > 1) return blocked('ambiguous_existing_breeder_threads', receipts, skipped);

    const marker = recordMarker(card.id);
    const payload = buildAquapediaPost(card);
    payload.content += '\n' + marker;
    payload.allowedMentions = { parse: [] };
    const botId = guild.client.user.id;
    let thread = matches[0];
    if (thread) {
      let history;
      try { history = await fullMessageHistory(thread); }
      catch { return blocked('thread_history_incomplete', receipts, skipped); }
      if (history.some((m) => safe(m.content).includes(marker))) {
        skipped += 1;
        continue;
      }
      if (thread.archived) return blocked('existing_thread_archived_needs_review', receipts, skipped);
      if (typeof thread.send !== 'function') return blocked('thread_reply_unavailable', receipts, skipped);
      let sent;
      try { sent = await thread.send(payload); }
      catch { return blocked('discord_send_failed_or_uncertain', receipts, skipped); }
      let readback;
      try { readback = await thread.messages.fetch(sent.id); }
      catch { return blocked('write_unverified_stop_no_retry', receipts, skipped); }
      if (!verifiedBotReply(readback, botId, card.id)) {
        return blocked('write_readback_mismatch_stop_no_retry', receipts, skipped);
      }
      receipts.push({ recordId: card.id, threadId: thread.id, messageId: readback.id, verified: true });
      continue;
    }

    if (route.mode !== 'create_if_missing') {
      return blocked('required_existing_breeder_thread_missing', receipts, skipped);
    }
    // A topic with the breeder's name may already exist under a different title.
    // Never create a competing thread until those potential collisions are reviewed.
    const breederKey = normalized(route.breederKey);
    if (threads.some((candidate) => normalized(candidate.name).includes(breederKey))) {
      return blocked('potential_duplicate_breeder_subject_needs_review', receipts, skipped);
    }
    const createPermissions = forum.permissionsFor?.(guild.client.user);
    if (!createPermissions?.has(PermissionFlagsBits.CreatePublicThreads)) {
      return blocked('bot_missing_public_thread_creation_permission', receipts, skipped);
    }
    const capacity = await probePublicThreadCapacity(guild);
    if (!capacity.allowed) return blocked('discord_active_thread_capacity_guard', receipts, skipped);
    const safeName = ('Breeder — ' + safe(card.breederName || card.name)
      + ' [' + card.id + ']').slice(0, 100);
    try { thread = await forum.threads.create({
      name: safeName, message: payload, reason: 'Owner-approved original breeder evidence',
    }); } catch { return blocked('discord_create_failed_or_uncertain', receipts, skipped); }
    let starter;
    try { starter = await thread.fetchStarterMessage(); }
    catch { return blocked('starter_readback_failed_stop_no_retry', receipts, skipped); }
    if (!verifiedBotReply(starter, botId, card.id)) {
      return blocked('starter_readback_mismatch_stop_no_retry', receipts, skipped);
    }
    receipts.push({ recordId: card.id, threadId: thread.id, messageId: starter.id, verified: true });
  }
  return {
    posted: receipts.length, skipped, receipts,
    reason: receipts.length ? 'verified_readback_receipts' : 'all_matching_cards_already_present',
  };
}

// Routing must be reviewed against actual live forums, never inferred from an
// Instagram handle or vendor name. Exported only for offline validation.
export const VERIFIED_BREEDER_ROUTES = Object.freeze({
  'verified-savanna-2026-elsa-and-show': Object.freeze({
    forum: 'medaka-research', mode: 'existing_only', breederKey: 'Medaka-ya Savanna',
  }),
  'verified-tarumi-2026-kuro-rintou': Object.freeze({
    forum: 'medaka-research', mode: 'existing_only', breederKey: 'Masaharu Tarumi',
  }),
  'verified-larmax-2026-rili': Object.freeze({
    forum: 'shrimp-research', mode: 'create_if_missing', breederKey: 'Larmax',
  }),
  'verified-skyfish-2018-galaxy': Object.freeze({
    forum: 'shrimp-research', mode: 'create_if_missing', breederKey: 'SkyFish',
  }),
});
