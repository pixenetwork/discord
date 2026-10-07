import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';

import { layoutDefinition, publicationTagDefinitions, provisionTranslatedPublicationsForum } from '../src/layout.mjs';

test('Aquapedia layout includes translated-publications forum', () => {
  const layout = layoutDefinition();
  const section = layout.find((entry) => entry.category === '🔬・AQUAPEDIA RESEARCH');
  assert.ok(section);
  const forum = section.forums?.find((entry) => entry.name === '📚・translated-publications');
  assert.ok(forum);
  assert.match(forum.topic, /source, issue, year, and provenance/i);
});

test('translated-publications forum exposes bounded research tags', () => {
  const tags = publicationTagDefinitions();
  const names = tags.map((tag) => tag.name);
  assert.ok(names.includes('Japanese'));
  assert.ok(names.includes('Magazine'));
  assert.ok(names.includes('Official JMA'));
  assert.ok(names.includes('Kagami'));
  assert.ok(names.includes('Ryurin'));
  assert.ok(names.includes('Dragon Scale'));
  assert.ok(names.length <= 20);
  assert.equal(new Set(names).size, names.length);
});

test('forum provisioning reuses existing tag IDs by name', async () => {
  const roles = new Map([
    ['staff-id', { id: 'staff-id', name: 'Aquaphoria Staff' }],
    ['vendor-id', { id: 'vendor-id', name: 'Verified Aquaphoria Vendor' }],
  ]);
  const category = {
    id: 'category-id',
    name: '🔬・AQUAPEDIA RESEARCH',
    type: ChannelType.GuildCategory,
    permissionOverwrites: { set: async () => {} },
  };
  let editOptions;
  const forum = {
    id: 'forum-id',
    name: '📚・translated-publications',
    type: ChannelType.GuildForum,
    parentId: category.id,
    availableTags: [{ id: 'japanese-tag-id', name: 'Japanese', moderated: false }],
    edit: async (options) => { editOptions = options; },
    permissionOverwrites: { set: async () => {} },
  };
  const guild = {
    roles: {
      everyone: { id: 'everyone-id' },
      cache: {
        get: (id) => roles.get(id),
        filter: (predicate) => {
          const matches = [...roles.values()].filter(predicate);
          return { size: matches.length, first: () => matches[0] };
        },
      },
    },
    channels: { cache: { find: (predicate) => [category, forum].find(predicate) } },
  };

  await provisionTranslatedPublicationsForum(guild, { ownerUserId: 'owner-id' });

  assert.equal(editOptions.availableTags.find((tag) => tag.name === 'Japanese').id, 'japanese-tag-id');
  assert.equal(editOptions.availableTags.find((tag) => tag.name === 'Chinese').id, undefined);
});


test('Aquaphoria customer layout exposes the streamlined storefront and library sections', () => {
  const layout = layoutDefinition();
  const byCategory = new Map(layout.map((section) => [section.category, section]));
  for (const category of [
    '🫧・AQUAPHORIA — START HERE',
    '🛒・SHOP AQUAPHORIA',
    '🐟・MEDAKA & FISH',
    '🦐・SHRIMP',
    '🔎・REQUEST DESK',
    '📚・AQUAPEDIA',
    '🌿・COMMUNITY',
    '🛡️・AQUAPHORIA STAFF',
    '📚・AQUAPHORIA LIBRARY',
  ]) assert.ok(byCategory.has(category), `missing ${category}`);

  assert.ok(byCategory.get('🦐・SHRIMP').channels.some(([name]) => name === '🦐・shrimp-preorders'));
  assert.ok(byCategory.get('🔎・REQUEST DESK').channels.some(([name]) => name === '🎟️・open-a-ticket'));
  assert.equal(byCategory.get('📚・AQUAPHORIA LIBRARY').libraryOnly, true);
  assert.equal(byCategory.has('🎫・CUSTOMER SUPPORT'), false);
});


test('private forum provisioning requires the configured owner to resolve to a cached Discord user', async () => {
  const roles = new Map([
    ['staff-id', { id: 'staff-id', name: 'Aquaphoria Staff' }],
    ['vendor-id', { id: 'vendor-id', name: 'Verified Aquaphoria Vendor' }],
  ]);
  const guild = {
    roles: {
      everyone: { id: 'everyone-id' },
      cache: {
        get: (id) => roles.get(id),
        filter: (predicate) => {
          const matches = [...roles.values()].filter(predicate);
          return { size: matches.length, first: () => matches[0] };
        },
      },
    },
    channels: {
      cache: { find: () => undefined },
      async create() { throw new Error('channel creation should not run before owner validation'); },
    },
    members: { cache: new Map() },
  };

  await assert.rejects(
    () => provisionTranslatedPublicationsForum(guild, { ownerUserId: 'owner-id' }),
    /owner .* is not cached/i,
  );
});
