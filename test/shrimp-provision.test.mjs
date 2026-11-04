import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionShrimpPublicResearchForum, provisionArowanaPublicResearchForum } from '../src/layout.mjs';
import { RESEARCH_GUILD_ID, RESEARCH_CATEGORY, RESEARCH_FORUMS } from '../src/canonical-research-forums.mjs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

function fixture({ otherGuild = false, hidden = false, missing = false, includeCopy = true } = {}) {
  const writes = [];
  const everyone = { id: 'everyone' };
  const allowed = {
    permissionsFor: () => ({ has: flag => !hidden || flag !== PermissionFlagsBits.ReadMessageHistory }),
  };
  const category = { id: RESEARCH_CATEGORY.id, name: RESEARCH_CATEGORY.name, type: ChannelType.GuildCategory, ...allowed };
  const forums = Object.values(RESEARCH_FORUMS).map(spec => ({
    ...allowed, id: spec.id, name: spec.name, parentId: category.id, type: ChannelType.GuildForum,
  }));
  const copy = { ...allowed, id: '1562207090670305280', name: '🦐・shrimp-research',
    parentId: '1557338241903099945', type: ChannelType.GuildForum };
  const all = [category, ...(!missing ? forums : []), ...(includeCopy ? [copy] : [])];
  return {
    writes,
    guild: { id: otherGuild ? '999999999999999999' : RESEARCH_GUILD_ID,
      roles: { everyone },
      channels: { cache: new Map(all.map(x => [x.id,x])), async create(spec) { writes.push(spec); throw new Error('channel creation forbidden'); } },
    },
  };
}

test('canonical shrimp and arowana provisioning reuses historical forums without edits or channel creation', async () => {
  const { guild, writes } = fixture();
  const shrimp = await provisionShrimpPublicResearchForum(guild);
  const arowana = await provisionArowanaPublicResearchForum(guild);
  assert.equal(shrimp.status, 'ready');
  assert.equal(arowana.status, 'ready');
  assert.equal(shrimp.channelId, RESEARCH_FORUMS.shrimp.id);
  assert.equal(arowana.channelId, RESEARCH_FORUMS.arowana.id);
  assert.equal(writes.length, 0);
});

test('same-named general Aquapedia forum never substitutes for missing canonical forum', async () => {
  const { guild, writes } = fixture({ missing: true });
  assert.equal((await provisionShrimpPublicResearchForum(guild)).status, 'canonical_forum_not_found');
  assert.equal(writes.length, 0);
});

test('mismatched configured guild refuses to route or create', async () => {
  const { guild, writes } = fixture({ otherGuild: true });
  assert.equal((await provisionShrimpPublicResearchForum(guild)).status, 'canonical_guild_mismatch');
  assert.equal(writes.length, 0);
});

test('canonical category and forum must expose history to everyone', async () => {
  const { guild, writes } = fixture({ hidden: true });
  assert.equal((await provisionShrimpPublicResearchForum(guild)).status, 'canonical_category_not_public');
  assert.equal(writes.length, 0);
});
