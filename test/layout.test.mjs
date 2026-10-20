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
  const ownerUser = { id: 'owner-id' };
  const guild = {
    members: { cache: new Map([['owner-id', { user: ownerUser }]]) },
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

test('canonical Aquapedia public layout matches three live category identities', () => {
  const sections = layoutDefinition();
  const intro = sections.find(x => x.category === '📚・AQUAPEDIA');
  const species = sections.find(x => x.category === '🧬・AQUAPEDIA — SPECIES & GENETICS');
  const publications = sections.find(x => x.category === '📰・AQUAPEDIA — MAGAZINES & ARTICLES');
  assert.equal(intro.categoryId, '1557338241903099945');
  assert.equal(species.categoryId, '1561430495680667719');
  assert.equal(publications.categoryId, '1561430509328932955');
  assert.equal(intro.channels.length, 4);
  assert.equal(intro.forums, undefined);
  assert.deepEqual(species.channels, []);
  assert.deepEqual(publications.channels, []);
  assert.equal(species.forums.length, 6);
  assert.equal(publications.forums.length, 5);
  assert.ok([...species.forums, ...publications.forums].every(f => f.protectExisting && f.id.length >= 17));
  assert.equal(new Set([...species.forums, ...publications.forums].map(f => f.id)).size, 11);
});

test('research forums retain exact live IDs and evidence tags', () => {
  const species = layoutDefinition().find(x => x.category === '🧬・AQUAPEDIA — SPECIES & GENETICS');
  for (const [name, id, tags] of [
    ['🐟・corydoras-research','1560887812910350339',['Research index','Named species','C-number','CW-number','Captive strain','Breeding','Taxonomy','ID / Lookalikes','Needs review']],
    ['🐟・pleco-research','1560931428680601630',['Research index','Named species','L-number','Captive morph','Breeding','Breeder history','Taxonomy','Conservation','Needs review']],
    ['🧬・shrimp-genes','1561148229784043544',['Caridina','Neocaridina','Lineage','Genetics','Evidence']],
    ['🐟・medaka-research','1561189286399705128',['Breeder','Strain','Lineage','Competition','Evidence']],
    ['🦐・shrimp-research','1561189288090140743',['Breeder','Strain','Competition','Lineage','Genetics','Husbandry']],
    ['🐉・arowana-research','1561193084899819680',['Species','Genetics','Regional','Breeding','Conservation']],
  ]) {
    const match = species.forums.filter(f => f.name === name);
    assert.equal(match.length, 1);
    assert.equal(match[0].id, id);
    assert.deepEqual(match[0].tags.map(t => t.name), tags);
  }
});

test('four magazine title forums and original public article forum retain live IDs and tags', () => {
  const pub = layoutDefinition().find(x => x.category === '📰・AQUAPEDIA — MAGAZINES & ARTICLES');
  const expected = [
    ['🗞️・magazines-and-articles','1560781594032345179'],
    ['📖・medaka-hyakka','1561284004936687697'],
    ['📘・medaka-advance','1561284007767965817'],
    ['🦐・shrimp-club','1561284010464776206'],
    ['🐟・medaka-trip','1561284012926832680'],
  ];
  const sharedTags = ['Issue','English Guide','Reading Notes','History','Breeding','Traits','Genetics','Care'];
  for (const [name,id] of expected) {
    const matches = pub.forums.filter(x => x.name === name);
    assert.equal(matches.length,1);
    assert.equal(matches[0].id,id);
    assert.ok(matches[0].protectExisting);
    if (name !== '🗞️・magazines-and-articles') {
      assert.deepEqual(matches[0].tags.map(x => x.name),sharedTags);
      assert.match(matches[0].topic,/No republished copyrighted magazine scans/);
    }
  }
  assert.match(pub.forums[0].topic,/No unlicensed reproductions/);
});
