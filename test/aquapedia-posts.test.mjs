import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaPost, publishAquapediaCards } from '../src/aquapedia-posts.mjs';
import { signedBreederFixture } from './helpers/breeder-auth-fixture.mjs';

const breeder = { id: 'BREEDER-1', entityType: 'breeder', name: 'Tarumi Medaka', japaneseName: '垂水メダカ', description: 'Medaka line-development breeder', history: 'Some line history is breeder-reported', sources: ['https://piscesbook.com/archives/25289'], confidence: 'Specialist publisher, breeder cross unverified', photos: [
  { url: 'https://example.com/owned.jpg', reuseStatus: 'owner_owned', credit: 'Breeder; approved', view: 'side' },
  { url: 'https://example.com/portrait.png', reuseStatus: 'permission_granted', credit: 'Breeder; portrait', view: 'top' },
  { url: 'https://example.com/unlicensed.jpg', reuseStatus: 'unknown', credit: 'Third party' },
] };
const strain = { id: 'STRAIN-1', entityType: 'strain', name: 'Fromage', japaneseName: 'フロマージュ', breederName: 'Tarumi Medaka', lineage: 'Breeder-reported long-fin parent crosses', description: 'Long-fin expression', confidence: 'Publisher reported, not DNA-verified', sources: ['https://piscesbook.com/archives/25276'] };

function guildWithForums(names) {
  const events = [];
  const category = { id: 'category-1', guildId: 'test-guild', name: '🔬・BREEDER RESEARCH', type: 4 };
  const forums = names.map((name, i) => ({
    id: 'forum-' + i, guildId: 'test-guild', name, type: 15, parentId: category.id,
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map() }; },
      async create({ name: title, message }) {
        events.push({ op: 'create', forumName: name, title, message });
        const starter = { id: 'message-' + events.length, author: { id: 'test-bot' }, embeds: message.embeds };
        return { id: 'thread-' + events.length, name: title, archived: false,
          async fetchStarterMessage() { return starter; },
          async send(payload) { events.push({ op: 'send', payload }); } };
      },
    }
  }));
  return { guild: { client: { user: { id: 'test-bot' } }, channels: { cache: new Map([['category', category], ...forums.map((forum) => [forum.name, forum])]) } }, events };
}

async function publishSignedPrivate(guild, result) {
  const fixture = signedBreederFixture(guild, result);
  return publishAquapediaCards(guild, fixture.result, fixture.authority);
}

test('breeder card contains substantive info and only licensed inline photos', () => {
  const result = buildAquapediaPost(breeder);
  assert.match(result.embeds[0].description, /垂水/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Origins / development history').value, /line history/);
  assert.equal(result.embeds[0].image.url, 'https://example.com/owned.jpg');
  assert.equal(result.embeds[1].image.url, 'https://example.com/portrait.png');
  assert.equal(result.embeds.length, 2);
  assert.deepEqual(result.allowedMentions.parse, []);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Research sources').value, /piscesbook/);
});

test('strain card includes lineage, uncertainty and photo-rights notice', () => {
  const result = buildAquapediaPost(strain);
  assert.match(result.content, /pending documented reuse permission/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Lineage / parent crosses').value, /long-fin/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Evidence confidence').value, /not DNA-verified/);
  assert.ok(!result.embeds[0].image);
});

test('rejects unlicensed and unsafe HTTP/localhost URLs', () => {
  const result = buildAquapediaPost({ ...strain, photos: [
    { url: 'http://example.com/fish.jpg', credit: 'Owner', reuseStatus: 'owner_owned' },
    { url: 'https://localhost/fish.jpg', credit: 'Owner', reuseStatus: 'owner_owned' }
  ], sources: ['javascript:alert(1)', 'http://example.com/page'] });
  assert.equal(result.embeds.length, 1);
  assert.ok(!result.embeds[0].image);
  assert.equal(result.embeds[0].fields.find((f) => f.name === 'Research sources').value, 'Original-source citation pending');
});

test('unreviewed or queued work never posts', async () => {
  const { guild } = guildWithForums(['tarumi-medaka']);
  const x = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: false, cards: [breeder] });
  assert.equal(x.posted, 0);
  assert.equal(x.reason, 'review_or_completion_pending');
});

test('breeder profile and strains create separate threads inside existing breeder forum', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka', 'unknown-breeders']);
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain, breeder] });
  assert.equal(result.posted, 2);
  assert.deepEqual(events.map((e) => e.op), ['create', 'create']);
  // Discord MessageFlags.SuppressNotifications is 4096: only starter creation is muted.
  assert.equal(events[0].message.flags, 4096);
  assert.equal(events[1].message.flags, 4096);
  assert.deepEqual(events.map((e) => e.forumName), ['tarumi-medaka', 'tarumi-medaka']);
  assert.match(events[0].title, /Breeder profile/);
  assert.equal(events[1].title, 'Fromage');
  assert.equal(events[0].message.embeds[0].image.url, 'https://example.com/owned.jpg');
  assert.match(events[1].message.embeds[0].fields.find((v) => v.name === 'Lineage / parent crosses').value, /long-fin/);
});

test('does not create new forums for unknown named breeders', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka', 'unknown-breeders']);
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true, cards: [{ ...strain, breederName: 'Unlisted Medaka' }] });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'forum_binding_not_authorized');
  assert.equal(events.length, 0);
});

test('unknown breeder uses existing unknown-breeders forum when explicitly routed', async () => {
  const { guild, events } = guildWithForums(['unknown-breeders']);
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true, cards: [{ ...strain, breederName: null, breederIdentityStatus: 'unverified', breederForumName: 'unknown-breeders' }] });
  assert.equal(result.posted, 1);
  assert.equal(events[0].forumName, 'unknown-breeders');
});

test('does not post in unrelated forums with same name outside breeder category', async () => {
  const { guild } = guildWithForums(['tarumi-medaka']);
  guild.channels.cache.get('tarumi-medaka').parentId = 'different-category';
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain] });
  assert.equal(result.posted, 0);
});

test('private IPv4 and loopback IPv6 photo URLs cannot be embedded', () => {
  const result = buildAquapediaPost({
    ...strain,
    photos: [
      { url: 'https://127.0.0.1/private.png', reuseStatus: 'owner_owned', credit: 'Unknown' },
      { url: 'https://[::1]/private.png', reuseStatus: 'licensed', credit: 'Unknown' },
      { url: 'https://192.168.1.1/private.png', reuseStatus: 'cc0', credit: 'Unknown' },
    ]
  });
  assert.equal(result.embeds.length, 1);
  assert.ok(!result.embeds[0].image);
});


test('private breeder posts resolve a verified breeder forum in BREEDER RESEARCH II', async () => {
  const { guild, events } = guildWithForums(['Kondo-Toshitsugu-近藤利継']);
  guild.channels.cache.set('category-2', { id: 'category-2', guildId: 'test-guild', name: '🔬・BREEDER RESEARCH II', type: 4 });
  guild.channels.cache.get('Kondo-Toshitsugu-近藤利継').parentId = 'category-2';
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true,
    cards: [{ ...strain, breederName: 'Kondo Toshitsugu', breederForumName: 'Kondo-Toshitsugu-近藤利継' }] });
  assert.equal(result.posted, 1);
  assert.equal(events[0].forumName, 'Kondo-Toshitsugu-近藤利継');
  assert.equal(events[0].title, 'Fromage');
});

test('private breeder routing refuses ambiguous same-name forums across research categories', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka']);
  guild.channels.cache.set('category-2', { id: 'category-2', guildId: 'test-guild', name: '🔬・BREEDER RESEARCH II', type: 4 });
  const duplicate = { ...guild.channels.cache.get('tarumi-medaka'), id: 'second-tarumi', parentId: 'category-2' };
  guild.channels.cache.set('second-tarumi', duplicate);
  const result = await publishSignedPrivate(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain] });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'forum_binding_not_authorized');
  assert.equal(events.length, 0);
});

test('contradictory breeder attribution makes zero Discord API calls', async () => {
  const { guild, events } = guildWithForums(['wang-xin-jiangyu', 'tarumi-medaka']);
  const result = await publishSignedPrivate(guild, {
    status: 'completed', discordPublicationApproved: true,
    cards: [{ ...strain, breederName: 'Wang Xin', breederForumName: 'tarumi-medaka' }],
  });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'forum_binding_not_authorized');
  assert.equal(events.length, 0);
});

test('oversized private batch is denied as a whole, not silently truncated', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka']);
  const result = await publishSignedPrivate(guild, {
    status: 'completed', discordPublicationApproved: true,
    cards: Array.from({ length: 31 }, (_, i) => ({ ...strain, id: 'STRAIN-' + (i + 1) })),
  });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'breeder_batch_exceeds_limit');
  assert.equal(events.length, 0);
});

test('forum parent changes during fetchActive produces zero mutations (create path)', async () => {
  const events = [];
  const category = { id: 'cat-original', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
  const otherCategory = { id: 'cat-intruder', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH II' };
  const forum = {
    id: 'forum-tarumi', guildId: 'test-guild', type: 15, name: 'tarumi-medaka', parentId: 'cat-original',
    threads: {
      async fetchActive() {
        // Simulate parent change during fetchActive
        forum.parentId = 'cat-intruder';
        return { threads: new Map() };
      },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create() { events.push('create'); return {}; },
    },
  };
  const gld = {
    id: 'test-guild',
    client: { user: { id: 'test-bot' } },
    channels: {
      cache: new Map([['cat', category], ['cat2', otherCategory], ['f', forum]]),
      async fetch(id) {
        if (id === 'forum-tarumi') return { ...forum };
        if (id === 'cat-original') return category;
        if (id === 'cat-intruder') return otherCategory;
        return null;
      },
    },
  };
  const { result, authority } = signedBreederFixture(gld, {
    status: 'completed', discordPublicationApproved: true,
    cards: [{ id: 'STRAIN-1', entityType: 'strain', name: 'Fromage',
      breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
      sources: ['https://piscesbook.com/archives/25276'] }],
  });
  const r = await publishAquapediaCards(gld, result, authority);
  assert.equal(r.posted, 0);
  assert.equal(events.length, 0);
});

test('whole-batch preflight: malformed second card returns posted=0, zero events, receipt unclaimed', async () => {
  const events = [];
  const category = { id: 'cat-1', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
  const forum = {
    id: 'forum-tarumi', guildId: 'test-guild', type: 15, name: 'tarumi-medaka', parentId: 'cat-1',
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create() { events.push('create'); return {}; },
    },
  };
  const gld = {
    id: 'test-guild',
    client: { user: { id: 'test-bot' } },
    channels: {
      cache: new Map([['cat', category], ['f', forum]]),
      async fetch(id) { return gld.channels.cache.get(id) ?? null; },
    },
  };
  const validCard = { id: 'STRAIN-OK', entityType: 'strain', name: 'Fromage',
    breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
    sources: ['https://piscesbook.com/archives/25276'] };
  const badCard = { id: '', entityType: 'strain', name: '',
    breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka' };
  const { result, authority, getClaimed } = signedBreederFixture(gld, {
    status: 'completed', discordPublicationApproved: true,
    cards: [validCard, badCard],
  });
  const r = await publishAquapediaCards(gld, result, authority);
  assert.equal(r.posted, 0);
  assert.equal(events.length, 0);
  assert.equal(getClaimed(), false);
});

test('private edit path denies a forum move during message-history lookup before reopen or edit', async () => {
  const events = [];
  const fetchCalls = [];
  const category = { id: 'cat-original', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
  const intruder = { id: 'cat-intruder', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH II' };
  const previous = {
    id: 'message-edit',
    author: { id: 'test-bot' },
    embeds: [{ footer: { text: 'Aquapedia • STRAIN-EDIT • photos pending rights review' } }],
    async edit() { events.push('edit'); },
  };
  const existingThread = {
    id: 'thread-edit', name: 'Fromage', archived: true,
    messages: { async fetch() {
      forum.parentId = 'cat-intruder';
      return new Map([['message-edit', previous]]);
    } },
    async setArchived() { events.push('reopen'); },
  };
  const forum = {
    id: 'forum-tarumi', guildId: 'test-guild', type: 15, name: 'tarumi-medaka', parentId: 'cat-original',
    threads: {
      async fetchActive() { return { threads: new Map([['thread-edit', existingThread]]) }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create() { events.push('create'); return {}; },
    },
  };
  const gld = {
    id: 'test-guild',
    client: { user: { id: 'test-bot' } },
    channels: {
      cache: new Map([['cat', category], ['cat2', intruder], ['forum', forum]]),
      async fetch(id, options) {
        fetchCalls.push({ id, options });
        if (id === 'forum-tarumi') return { ...forum };
        if (id === 'cat-original') return category;
        return null;
      },
    },
  };
  const card = { id: 'STRAIN-EDIT', entityType: 'strain', name: 'Fromage',
    breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
    sources: ['https://piscesbook.com/archives/25276'] };
  const { result, authority } = signedBreederFixture(gld, {
    status: 'completed', discordPublicationApproved: true, cards: [card],
  });
  const publicationResult = await publishAquapediaCards(gld, result, authority);
  assert.equal(publicationResult.posted, 0);
  assert.deepEqual(events, []);
  assert.ok(fetchCalls.length >= 2 && fetchCalls.every((call) => call.options?.force === true));
});

test('private edit path revalidates destination after awaited reopen before editing', async () => {
  const events = [];
  const fetchCalls = [];
  const category = { id: 'cat-original', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
  const intruder = { id: 'cat-intruder', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH II' };
  const previous = {
    id: 'message-reopen',
    author: { id: 'test-bot' },
    embeds: [{ footer: { text: 'Aquapedia • STRAIN-REOPEN • photos pending rights review' } }],
    async edit() { events.push('edit'); },
  };
  const existingThread = {
    id: 'thread-reopen', name: 'Fromage', archived: true,
    messages: { async fetch() { return new Map([['message-reopen', previous]]); } },
    async setArchived() {
      events.push('reopen');
      forum.parentId = 'cat-intruder';
    },
  };
  const forum = {
    id: 'forum-tarumi', guildId: 'test-guild', type: 15, name: 'tarumi-medaka', parentId: 'cat-original',
    threads: {
      async fetchActive() { return { threads: new Map([['thread-reopen', existingThread]]) }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create() { events.push('create'); return {}; },
    },
  };
  const gld = {
    id: 'test-guild',
    client: { user: { id: 'test-bot' } },
    channels: {
      cache: new Map([['cat', category], ['cat2', intruder], ['forum', forum]]),
      async fetch(id, options) {
        fetchCalls.push({ id, options });
        if (id === 'forum-tarumi') return { ...forum };
        if (id === 'cat-original') return category;
        return null;
      },
    },
  };
  const card = { id: 'STRAIN-REOPEN', entityType: 'strain', name: 'Fromage',
    breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
    sources: ['https://piscesbook.com/archives/25276'] };
  const { result, authority } = signedBreederFixture(gld, {
    status: 'completed', discordPublicationApproved: true, cards: [card],
  });
  const publicationResult = await publishAquapediaCards(gld, result, authority);
  assert.equal(publicationResult.posted, 0);
  assert.deepEqual(events, ['reopen']);
  assert.ok(fetchCalls.length >= 4 && fetchCalls.every((call) => call.options?.force === true));
});

test('private create path denies when approval expires during async thread lookup', async () => {
  const events = [];
  const category = { id: 'cat-1', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
  const forum = {
    id: 'forum-tarumi', guildId: 'test-guild', type: 15, name: 'tarumi-medaka', parentId: 'cat-1',
    threads: {
      async fetchActive() { Date.now = () => expiresAt + 1; return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create() { events.push('create'); return {}; },
    },
  };
  const gld = {
    id: 'test-guild',
    client: { user: { id: 'test-bot' } },
    channels: {
      cache: new Map([['cat', category], ['forum', forum]]),
      async fetch(id, options) {
        if (id === 'forum-tarumi') return { ...forum };
        if (id === 'cat-1') return category;
        return null;
      },
    },
  };
  const card = { id: 'STRAIN-EXPIRE-LOOKUP', entityType: 'strain', name: 'Fromage',
    breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
    sources: ['https://piscesbook.com/archives/25276'] };
  const { result, authority, receiptData } = signedBreederFixture(gld, {
    status: 'completed', discordPublicationApproved: true, cards: [card],
  });
  const originalNow = Date.now;
  const expiresAt = Date.parse(receiptData.expiresAt);
  try {
    const publicationResult = await publishAquapediaCards(gld, result, authority);
    assert.equal(publicationResult.posted, 0);
    assert.deepEqual(events, []);
  } finally {
    Date.now = originalNow;
  }
});

test('private create without fresh-channel capability fails closed before write', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka']);
  const fixture = signedBreederFixture(guild, {
    status: 'completed', discordPublicationApproved: true, cards: [strain],
  });
  delete guild.channels.fetch;
  const outcome = await publishAquapediaCards(guild, fixture.result, fixture.authority);
  assert.equal(outcome.posted, 0);
  assert.deepEqual(events, []);
});

for (const path of ['create', 'edit', 'reopen']) {
  test('private ' + path + ' denies forum move during awaited category fetch with stale cached parent', async () => {
    const events = [];
    const requests = [];
    let serverParentId = 'cat-original';
    const category = { id: 'cat-original', guildId: 'test-guild', type: 4, name: '🔬・BREEDER RESEARCH' };
    const previous = {
      id: 'message-race', author: { id: 'test-bot' },
      embeds: [{ footer: { text: 'Aquapedia • STRAIN-RACE • photos pending rights review' } }],
      async edit() { events.push('edit'); },
    };
    const existingThread = {
      id: 'thread-race', name: 'Fromage', archived: path === 'reopen',
      messages: {
        async fetch(key) { return typeof key === 'string' ? previous : new Map([['message-race', previous]]); },
      },
      async setArchived() { events.push('reopen'); },
    };
    const forum = {
      id: 'forum-tarumi', guildId: 'test-guild', type: 15,
      name: 'tarumi-medaka', parentId: 'cat-original',
      threads: {
        async fetchActive() {
          return { threads: path === 'create' ? new Map() : new Map([['thread-race', existingThread]]) };
        },
        async fetchArchived() { return { threads: new Map(), hasMore: false }; },
        async create() {
          events.push('create');
          return { id: 'thread-created', async fetchStarterMessage() { return previous; } };
        },
      },
    };
    const guild = {
      id: 'test-guild', client: { user: { id: 'test-bot' } },
      channels: {
        cache: new Map([['cat-original', category], ['forum-tarumi', forum]]),
        async fetch(id, options) {
          requests.push({ id, options });
          if (options?.force !== true) throw new Error('fresh fetch required');
          if (id === 'forum-tarumi') {
            // Server response reflects state at the moment of this request. The
            // cached forum below intentionally retains its original signed parent.
            return { ...forum, parentId: serverParentId };
          }
          if (id === 'cat-original') {
            // Relocation happens while the awaited category request is in flight.
            serverParentId = 'cat-intruder';
            return category;
          }
          return null;
        },
      },
    };
    const card = {
      id: 'STRAIN-RACE', entityType: 'strain', name: 'Fromage',
      breederName: 'Tarumi Medaka', breederForumName: 'tarumi-medaka',
      sources: ['https://piscesbook.com/archives/25276'],
    };
    const f = signedBreederFixture(guild, {
      status: 'completed', discordPublicationApproved: true, cards: [card],
    });
    const outcome = await publishAquapediaCards(guild, f.result, f.authority);
    assert.equal(f.getClaimed(), true, 'authorization must be reached in this regression');
    assert.equal(serverParentId, 'cat-intruder', 'the server-side move must actually occur');
    assert.equal(forum.parentId, 'cat-original', 'cache must remain stale during the probe');
    assert.ok(requests.length >= 2, 'forced forum and category reads must occur');
    assert.equal(outcome.posted, 0);
    assert.deepEqual(events, [], 'no create, reopen or edit under moved server-side parent');
  });
}

test('private missing forum REST read after category lookup fails closed without throwing', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka']);
  guild.channels.fetch = async (id, options) => {
    assert.equal(options?.force, true);
    if (id === 'category-1') return guild.channels.cache.get('category');
    return null;
  };
  const f = signedBreederFixture(guild, {
    status: 'completed', discordPublicationApproved: true, cards: [strain],
  });
  const outcome = await publishAquapediaCards(guild, f.result, f.authority);
  assert.equal(outcome.posted, 0);
  assert.deepEqual(events, []);
});
