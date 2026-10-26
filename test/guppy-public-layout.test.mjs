import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { layoutDefinition, provisionGuppyPublicResearchResources } from '../src/layout.mjs';

test('guppy guides and research reuse the one existing public Aquapedia category', () => {
  const sections = layoutDefinition();
  const aquapedia = sections.filter((x) => x.category === '📚・AQUAPEDIA');
  assert.equal(aquapedia.length, 1);
  assert.ok(aquapedia[0].channels.some(([name]) => name === '🐠・guppy-guides'));
  const forums = aquapedia[0].forums.filter((forum) => forum.name === '🐠・guppy-research');
  assert.equal(forums.length, 1);
  assert.match(forums[0].topic, /trade names do not establish/i);
  assert.ok(forums[0].tags.some((tag) => tag.name === 'Genetics'));
  assert.equal(sections.filter((x) => /GUPPY/.test(x.category)).length, 0);
});

test('guppy provisioning refuses to mutate a private Aquapedia category', async () => {
  let created = 0;
  const everyone = { id: 'everyone' };
  const category = {
    id: '1557338241903099945', name: '📚・AQUAPEDIA', type: ChannelType.GuildCategory,
    permissionsFor: () => ({ has: (permission) => permission !== PermissionFlagsBits.ReadMessageHistory }),
  };
  const guild = {
    roles: { everyone },
    channels: {
      cache: { find: (predicate) => [category].find(predicate) },
      create: async () => { created++; throw new Error('unsafe provisioning attempt'); },
    },
  };
  const outcome = await provisionGuppyPublicResearchResources(guild);
  assert.equal(outcome.status, 'category_not_public');
  assert.equal(created, 0);
});
