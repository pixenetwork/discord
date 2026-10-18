import { ChannelType, PermissionFlagsBits } from 'discord.js';

/**
 * Finalize an EXISTING, approved, bot-owned, one-message public index card.
 *
 * This is deliberately not a general forum archival function. It cannot create
 * new threads, post messages, modify conversations, or archive private research.
 *
 * The caller owns the writer lock and must provide a durable persistReceipt
 * callback. The verified_unarchived receipt is committed BEFORE the archive
 * mutation, so a Discord failure remains recoverable without reposting.
 */
export async function finalizeStaticAquapediaCard({
  guild, forum, thread, botUserId, sourceUrl, marker, expectedMessageId,
  receiptId, publicCategoryId, strainTagId, persistReceipt,
} = {}) {
  if (typeof persistReceipt !== 'function') {
    throw new Error('A durable receipt writer is required before archival');
  }
  if (!receiptId || !expectedMessageId || !botUserId || !publicCategoryId || !strainTagId) {
    throw new Error('Static card IDs, bot identity and public destination must be explicit');
  }
  if (!/^\[AQUAPEDIA-PUBLIC-LINK:[a-f0-9]{18}\]$/.test(marker ?? '')) {
    throw new Error('A deterministic static card marker is required');
  }
  let url;
  try { url = new URL(String(sourceUrl ?? '')); }
  catch { throw new Error('Invalid Aquapedia source URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'aquapedia.app'
    || !/^\/(?:medakapedia\/strains|shrimpapedia\/strain-atlas)\/[a-z0-9-]+\/$/.test(url.pathname)
    || url.search || url.hash) {
    throw new Error('Static index card must point to a canonical public Aquapedia strain article');
  }
  if (forum?.type !== ChannelType.GuildForum || forum.parentId !== publicCategoryId
    || thread?.parentId !== forum.id || !/^STRAIN — \S/.test(thread?.name ?? '')
    || thread.locked || !thread.appliedTags?.includes(strainTagId)) {
    throw new Error('Static card forum, parent, tag, lock or identity is not authorized');
  }
  const everyone = guild?.roles?.everyone;
  const perms = everyone && forum?.permissionsFor?.(everyone);
  if (!perms?.has(PermissionFlagsBits.ViewChannel)
    || !perms.has(PermissionFlagsBits.ReadMessageHistory)) {
    throw new Error('Static card forum is not public with history visibility');
  }
  if (typeof thread.messages?.fetch !== 'function' || typeof thread.setArchived !== 'function') {
    throw new Error('Live thread readback and archival controls are required');
  }

  const live = typeof thread.fetch === 'function' ? await thread.fetch() : thread;
  if (live.locked || live.parentId !== forum.id || live.name !== thread.name
    || !live.appliedTags?.includes(strainTagId)) {
    throw new Error('Thread metadata changed during static card verification');
  }
  const history = await live.messages.fetch({ limit: 3 });
  const posts = [...history.values()];
  if (posts.length !== 1) throw new Error('Static card has discussion or unreadable message history');
  const post = posts[0];
  if (post.id !== expectedMessageId || post.author?.id !== botUserId
    || !post.content?.includes(marker) || !post.content?.includes(url.href)) {
    throw new Error('Bot authorship, source URL or exact static index marker cannot be verified');
  }

  const receipt = {
    receiptId: String(receiptId),
    threadId: live.id,
    messageId: post.id,
    sourceUrl: url.href,
    marker,
  };
  if (!live.archived) {
    await persistReceipt({ ...receipt, status: 'verified_unarchived' });
    await live.setArchived(true, 'Archive verified static Aquapedia index; preserve direct link');
  }
  const checked = typeof live.fetch === 'function' ? await live.fetch() : live;
  if (!checked.archived || checked.locked || checked.parentId !== forum.id) {
    throw new Error('Discord archive readback failed for verified static card');
  }
  const after = await checked.messages.fetch({ limit: 3 });
  const original = [...after.values()];
  if (original.length !== 1 || original[0].id !== expectedMessageId
    || original[0].content !== post.content || original[0].author?.id !== botUserId) {
    throw new Error('Archived static card content changed or became unreadable');
  }
  await persistReceipt({ ...receipt, status: 'archived_verified' });
  return { ...receipt, archived: true, verified: true };
}
