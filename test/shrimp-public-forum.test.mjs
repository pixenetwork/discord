import test from 'node:test';
import assert from 'node:assert/strict';
import { publishAquapediaCards, buildAquapediaPost } from '../src/aquapedia-posts.mjs';

const breeder = {
  id: 'shrimp-breeder-skyfish', entityType: 'breeder', organismGroup: 'shrimp',
  name: 'Skyfish / Leon Su', breeding: 'Line-selection documented',
  sources: ['https://aquapedia.app/shrimpapedia/breeders/skyfish-leon-su/'], photos: []
};
const contest = {
  id: 'shrimp-contest-tgisc', entityType: 'competition', organismGroup: 'shrimp',
  name: 'German International Shrimp Contest',
  message: 'Documented TGISC 2026 competition results, provisional creator attribution.',
  sources: ['https://aquapedia.app/shrimpapedia/competitions/german-international-shrimp-contest-tgisc/']
};

function fakeGuild({ visible = true, categoryName = '📚・AQUAPEDIA', forumName = '🦐・shrimp-research' } = {}) {
  const created = [];
  const category = { id: 'public-category', name: categoryName, type: 4 };
  const forum = {
    id: 'shrimp-forum', name: forumName, type: 15, parentId: category.id,
    permissionsFor(role) { return role?.id === 'everyone' ? { has: () => visible } : null; },
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create({ name, message }) {
        const id = String(created.length + 1);
        const post = { id: 'message-' + id, author: { id: 'aquaphoria-bot' }, embeds: message.embeds };
        created.push({ name, message });
        return { id: 'thread-' + id, name, async fetchStarterMessage() { return post; } };
      },
    },
  };
  const guild = { roles: { everyone: { id: 'everyone' } }, client: { user: { id: 'aquaphoria-bot' } },
    channels: { cache: new Map([['cat', category], ['forum', forum]]) } };
  return { guild, created };
}

const approved = {
  status: 'completed', discordPublicationApproved: true, publicShrimpResearch: true,
  publicAudienceApproved: true, cards: [breeder, contest],
};

test('public shrimp batch creates two evidence-linked breeder/competition threads only in the Aquapedia forum', async () => {
  const { guild, created } = fakeGuild();
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 2);
  assert.equal(result.receipts.length, 2);
  assert.match(created[0].name, /Skyfish/);
  assert.match(created[1].name, /German International/);
  assert.ok(created[1].message.content.includes('Documented TGISC'));
});

test('public shrimp route remains closed without explicit public-audience approval', async () => {
  const { guild, created } = fakeGuild();
  const result = await publishAquapediaCards(guild, { ...approved, publicAudienceApproved: false });
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('public shrimp publishing refuses a forum that is not public to everyone', async () => {
  const { guild, created } = fakeGuild({ visible: false });
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('public shrimp publishing refuses a forum outside the public Aquapedia category', async () => {
  const { guild, created } = fakeGuild({ categoryName: '🔬・AQUAPEDIA RESEARCH' });
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('competition embed retains source citations and never calls its entrant the strain creator', () => {
  const payload = buildAquapediaPost(contest);
  assert.match(payload.embeds[0].title, /COMPETITION/);
  assert.match(JSON.stringify(payload), /aquapedia.app/);
  assert.doesNotMatch(JSON.stringify(payload), /original creator: German International/i);
});
