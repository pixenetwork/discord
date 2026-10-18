import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { buildAquapediaPost, publishAquapediaCards } from '../src/aquapedia-posts.mjs';

const MEDAKA_FORUM_ID = '1561189286399705128';
const archive = 'https://aquapedia.app/medakapedia/competitions/';
const contest = {
  id: 'medaka-ima-2025-awards', entityType: 'competition', organismGroup: 'medaka',
  name: 'International Medaka Association — 8th show 2025',
  message: 'Ten IMA classes, selected primary-source placements; an entrant is not necessarily a strain creator.',
  sources: ['https://ima-medaka.or.jp/8th_result/', archive],
  websiteUrl: archive, photos: []
};

function mockGuild({ publicVisible = true, historyVisible = true, forumId = MEDAKA_FORUM_ID,
  forumName = '🐟・medaka-research', categoryName = '📚・AQUAPEDIA',
  activeThreadCount = 200, capacityUnavailable = false } = {}) {
  const created = [];
  const category = { type: 4, id: 'aquapedia-category', name: categoryName };
  const forum = {
    type: 15, id: forumId, parentId: category.id, name: forumName,
    permissionsFor(role) {
      if (role?.id !== 'everyone') return null;
      return { has: (flag) => flag === PermissionFlagsBits.ReadMessageHistory ? historyVisible : publicVisible };
    },
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create({ name, message }) {
        created.push({ name, message });
        return {
          id: 'new-thread-1', name,
          async fetchStarterMessage() {
            return { id: 'new-message-1', author: { id: 'aquaphoria-bot' }, embeds: message.embeds };
          }
        };
      },
    }
  };
  const guild = {
    roles: { everyone: { id: 'everyone' } },
    client: { user: { id: 'aquaphoria-bot' } },
    channels: {
      cache: new Map([['cat', category], ['forum', forum]]),
      async fetchActiveThreads() {
        if (capacityUnavailable) throw new Error('guild active thread inventory unavailable');
        return { threads: { size: activeThreadCount } };
      },
    }
  };
  return { guild, created };
}

const approved = {
  status: 'completed',
  discordPublicationApproved: true, publicAudienceApproved: true,
  publicMedakaResearch: true, cards: [contest],
};

test('approved sourced Medaka competition uses only the existing public forum with readback receipt', async () => {
  const { guild, created } = mockGuild();
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 1);
  assert.equal(result.unverified, 0);
  assert.equal(result.receipts.length, 1);
  assert.deepEqual(result.receipts[0], {
    recordId: contest.id, threadId: 'new-thread-1', messageId: 'new-message-1', verified: true
  });
  assert.match(created[0].name, /International Medaka Association/);
  const rendered = JSON.stringify(created[0].message);
  assert.match(rendered, /ima-medaka\.or\.jp/);
  assert.doesNotMatch(rendered, /original creator: International/);
  assert.deepEqual(created[0].message.allowedMentions, { parse: [] });
});

test('Medaka public destination requires both publisher and public audience approvals', async () => {
  for (const update of [{ discordPublicationApproved: false }, { publicAudienceApproved: false }, { status: 'pending' }]) {
    const { guild, created } = mockGuild();
    const res = await publishAquapediaCards(guild, { ...approved, ...update });
    assert.equal(res.posted, 0);
    assert.equal(created.length, 0);
  }
});

test('Medaka competition only uses verified existing public forum and category', async () => {
  for (const settings of [{ forumId: 'different-forum' }, { forumName: 'medaka-research-copy' },
    { categoryName: '🔬・BREEDER RESEARCH' }, { publicVisible: false }, { historyVisible: false }]) {
    const { guild, created } = mockGuild(settings);
    const result = await publishAquapediaCards(guild, approved);
    assert.equal(result.posted, 0);
    assert.equal(created.length, 0);
  }
});

test('Medaka public competition rejects unpublished or unauthenticated references and images', async () => {
  const bad = [
    { ...contest, websiteUrl: 'https://aquapedia.app/medakapedia/' },
    { ...contest, sources: ['https://aquapedia.app/medakapedia/competitions/'] },
    { ...contest, sources: ['https://ima-medaka.or.jp.evil.example/'] },
    { ...contest, sources: ['http://ima-medaka.or.jp/8th_result/'] },
    { ...contest, photos: undefined },
    { ...contest, photos: [{url:'https://example.org/a.jpg', reuseStatus:'licensed'}] },
    { ...contest, organismGroup: 'shrimp' },
    { ...contest, entityType: 'breeder' },
  ];
  for (const card of bad) {
    const { guild, created } = mockGuild();
    const res = await publishAquapediaCards(guild, { ...approved, cards: [card] });
    assert.equal(res.posted, 0, JSON.stringify(card));
    assert.equal(created.length, 0);
  }
});

test('Medaka source must include real direct organizer evidence, not just an Aquapedia URL', async () => {
  const { guild, created } = mockGuild();
  const res = await publishAquapediaCards(guild, { ...approved, cards: [{ ...contest, sources: [archive, 'https://www.medakafest.com/#winners'] }] });
  assert.equal(res.posted, 1);
  assert.equal(created.length, 1);
});

test('Medaka public route disallows conflicting public targets and duplicate stable IDs', async () => {
  const { guild: conflictingGuild, created: conflictingPosts } = mockGuild();
  const both = await publishAquapediaCards(conflictingGuild, { ...approved, publicShrimpResearch: true });
  const { guild: duplicateGuild, created: duplicatePosts } = mockGuild();
  const dup = await publishAquapediaCards(duplicateGuild, { ...approved, cards: [contest, { ...contest }] });
  assert.equal(both.posted, 0);
  assert.equal(dup.posted, 0);
  assert.equal(conflictingPosts.length, 0);
  assert.equal(duplicatePosts.length, 0);
});

test('standalone Medaka competition rendering does not invent a founding breeder', () => {
  const payload = buildAquapediaPost(contest);
  assert.match(payload.embeds[0].title, /COMPETITION/);
  assert.match(payload.embeds[0].description, /not automatically the original strain creator/);
  assert.equal(payload.embeds[0].fields.length > 0, true);
});

test('missing or blank public card IDs are rejected before any Discord write', async () => {
  for (const id of [undefined, null, '', ' ']) {
    const { guild, created } = mockGuild();
    const result = await publishAquapediaCards(guild, {
      ...approved, cards: [{ ...contest, id }],
    });
    assert.equal(result.posted, 0);
    assert.equal(result.reason, 'invalid_or_duplicate_public_record_id');
    assert.equal(created.length, 0);
  }
});

test('one direct official organizer citation is sufficient with canonical websiteUrl', async () => {
  const { guild, created } = mockGuild();
  const result = await publishAquapediaCards(guild, { ...approved,
    cards: [{ ...contest, sources: ['https://ima-medaka.or.jp/8th_result/'] }],
  });
  assert.equal(result.posted, 1);
  assert.equal(result.reason, 'verified_in_existing_public_medaka_forum');
  assert.equal(created.length, 1);
});


test('Medaka public publisher preserves guild-wide thread capacity guard', async () => {
  for (const settings of [{ activeThreadCount: 950 }, { activeThreadCount: 1000 }, { capacityUnavailable: true }]) {
    const { guild, created } = mockGuild(settings);
    const result = await publishAquapediaCards(guild, approved);
    assert.equal(result.posted, 0, JSON.stringify(settings));
    assert.equal(result.reason, 'discord_thread_capacity_guard', JSON.stringify(settings));
    assert.equal(created.length, 0);
  }
});
