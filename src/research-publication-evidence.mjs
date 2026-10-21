export async function reconcileExternalPublication({
  store, jobId, receipt, guildId, medakaForumId, discordToken, fetchImpl = fetch,
}) {
  if (!/^[-0-9a-f]{36}$/i.test(String(jobId))) throw new Error('Invalid research job ID');
  if (!discordToken || !/^\d{15,22}$/.test(String(guildId)) ||
      !/^\d{15,22}$/.test(String(medakaForumId))) {
    throw new Error('Verified Discord bot configuration is required');
  }
  const job = await store.getResearchJob(jobId);
  if (!job || job.status !== 'queued' || job.entityType !== 'strain') {
    throw new Error('Only an existing queued strain request may be linked');
  }
  const slug = String(job.name ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Topic requires manual name reconciliation');
  const expectedSite = 'https://aquapedia.app/medakapedia/strains/' + slug + '/';
  if (receipt?.url !== expectedSite ||
      receipt?.guild !== guildId || receipt?.forum !== medakaForumId ||
      !/^\d{15,22}$/.test(String(receipt?.threadId)) ||
      !/^\d{15,22}$/.test(String(receipt?.messageId)) ||
      !/^\d{15,22}$/.test(String(receipt?.botId))) {
    throw new Error('Receipt site topic, guild, forum or IDs do not match the queued request');
  }

  const get = async (url, authorization = false) => {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: authorization ? { Authorization: 'Bot ' + discordToken } : {},
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Live publication evidence unavailable (HTTP '+response.status+')');
    return response;
  };

  const site = await get(expectedSite);
  const html = await site.text();
  if (!html.includes('data-medaka-picture-tree="1"') ||
      !html.includes('Parent lines not documented') ||
      !html.toLowerCase().includes(slug)) {
    throw new Error('Aquapedia public dossier lacks required source-bound lineage disclosure');
  }

  const base = 'https://discord.com/api/v10';
  const bot = await (await get(base + '/users/@me', true)).json();
  if (bot.id !== receipt.botId) throw new Error('Authenticated Discord bot does not match publication receipt');
  const thread = await (await get(base + '/channels/' + receipt.threadId, true)).json();
  if (thread.id !== receipt.threadId ||
      thread.parent_id !== medakaForumId || thread.guild_id !== guildId ||
      ![11, 12].includes(thread.type)) {
    throw new Error('Publication thread is not in the verified Medaka forum');
  }
  const message = await (await get(
    base + '/channels/' + receipt.threadId + '/messages/' + receipt.messageId, true,
  )).json();
  if (message.id !== receipt.messageId || message.channel_id !== receipt.threadId ||
      message.author?.id !== bot.id) {
    throw new Error('Published Discord message author or thread does not match the bot');
  }
  if (!String(message.content ?? '').includes(expectedSite) ||
      !String(message.content ?? '').toLowerCase().includes(slug) ||
      !String(message.content ?? '').includes('Parent lines not documented')) {
    throw new Error('Published Discord message does not link to the matching source-backed dossier');
  }
  // Yoru was published provisionally: a supplier is not proof of the creator.
  if (slug === 'yoru' &&
      (!html.includes('Mimu Medaka') || !message.content.includes('Mimu Medaka') ||
       !message.content.includes('NOT necessarily the original creator') ||
       !message.content.includes('Yoru Kuro'))) {
    throw new Error('Yoru creator/source distinction cannot be verified');
  }
  const postedAt = Date.parse(message.timestamp);
  if (!Number.isFinite(postedAt) || postedAt < Date.parse(job.createdAt)) {
    throw new Error('Publication must postdate the queued research request');
  }

  return store.recordResearchPublicationEvidence(job.id, {
    evidenceStatus: 'published_creator_pending',
    siteUrl: expectedSite,
    discordThreadId: receipt.threadId,
    discordMessageId: receipt.messageId,
    publicationBotId: bot.id,
    source: 'site_and_authenticated_discord_readback',
    remainingResearch: 'Original creator, parent lines and breeder confirmation remain open.',
  });
}
