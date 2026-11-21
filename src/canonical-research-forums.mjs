import { ChannelType, PermissionFlagsBits } from 'discord.js';

// Live read-only guild inventory and 2026-10-19 publication receipts.
// This maps established public forums only: it must never provision channels.
export const RESEARCH_GUILD_ID = '1519337502379475095';
export const RESEARCH_CATEGORY = Object.freeze({
  id: '1561430495680667719',
  name: '🧬・AQUAPEDIA — SPECIES & GENETICS',
});
export const RESEARCH_FORUMS = Object.freeze({
  shrimp: Object.freeze({ id: '1561189288090140743', name: '🦐・shrimp-research' }),
  arowana: Object.freeze({ id: '1561193084899819680', name: '🐉・arowana-research' }),
});

function publiclyReadable(channel, everyone) {
  const perms = channel?.permissionsFor?.(everyone);
  return Boolean(perms?.has(PermissionFlagsBits.ViewChannel)
    && perms?.has(PermissionFlagsBits.ReadMessageHistory));
}

export function resolveCanonicalResearchForum(guild, organism) {
  const spec = RESEARCH_FORUMS[organism];
  if (!spec) return { status: 'unsupported_research_group' };
  if (String(guild?.id ?? '') !== RESEARCH_GUILD_ID) return { status: 'canonical_guild_mismatch' };
  const everyone = guild?.roles?.everyone;
  const channels = [...(guild?.channels?.cache?.values?.() ?? [])];
  const category = channels.find((c) => c.type === ChannelType.GuildCategory
    && c.id === RESEARCH_CATEGORY.id && c.name === RESEARCH_CATEGORY.name);
  if (!category) return { status: 'canonical_category_not_found' };
  const forum = channels.find((c) => c.type === ChannelType.GuildForum
    && c.id === spec.id && c.name === spec.name && c.parentId === category.id);
  if (!forum) return { status: 'canonical_forum_not_found' };
  if (!everyone || !publiclyReadable(category, everyone)) return { status: 'canonical_category_not_public' };
  if (!publiclyReadable(forum, everyone)) return { status: 'canonical_forum_not_public' };
  return { status: 'ready', categoryId: category.id, channelId: forum.id, forumName: forum.name };
}
