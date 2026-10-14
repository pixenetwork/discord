import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaPost, publishAquapediaCards } from '../src/aquapedia-posts.mjs';

const breeder = { id: 'BREEDER-1', entityType: 'breeder', name: 'Tarumi Medaka', japaneseName: '垂水メダカ', description: 'Medaka line-development breeder', history: 'Some line history is breeder-reported', sources: ['https://piscesbook.com/archives/25289'], confidence: 'Specialist publisher, breeder cross unverified', photos: [
  { url: 'https://example.com/owned.jpg', reuseStatus: 'owner_owned', credit: 'Breeder; approved', view: 'side' },
  { url: 'https://example.com/portrait.png', reuseStatus: 'permission_granted', credit: 'Breeder; portrait', view: 'top' },
  { url: 'https://example.com/unlicensed.jpg', reuseStatus: 'unknown', credit: 'Third party' },
] };
const strain = { id: 'STRAIN-1', entityType: 'strain', name: 'Fromage', japaneseName: 'フロマージュ', breederName: 'Tarumi Medaka', lineage: 'Breeder-reported long-fin parent crosses', description: 'Long-fin expression', confidence: 'Publisher reported, not DNA-verified', sources: ['https://piscesbook.com/archives/25276'] };

function guildWithForums(names) {
  const events = [];
  const category = { id: 'category-1', name: '🔬・BREEDER RESEARCH', type: 4 };
  const forums = names.map((name, i) => ({
    id: 'forum-' + i, name, type: 15, parentId: category.id,
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map() }; },
      async create({ name: title, message }) {
        events.push({ op: 'create', forumName: name, title, message });
        return { id: 'thread-' + events.length, name: title, archived: false, async send(payload) { events.push({ op: 'send', payload }); } };
      },
    }
  }));
  return { guild: { channels: { cache: new Map([['category', category], ...forums.map((forum) => [forum.name, forum])]) } }, events };
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
  const x = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: false, cards: [breeder] });
  assert.equal(x.posted, 0);
  assert.equal(x.reason, 'review_or_completion_pending');
});

test('breeder profile and strains create separate threads inside existing breeder forum', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka', 'unknown-breeders']);
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain, breeder] });
  assert.equal(result.posted, 2);
  assert.deepEqual(events.map((e) => e.op), ['create', 'create']);
  assert.deepEqual(events.map((e) => e.forumName), ['tarumi-medaka', 'tarumi-medaka']);
  assert.match(events[0].title, /Breeder profile/);
  assert.equal(events[1].title, 'Fromage');
  assert.equal(events[0].message.embeds[0].image.url, 'https://example.com/owned.jpg');
  assert.match(events[1].message.embeds[0].fields.find((v) => v.name === 'Lineage / parent crosses').value, /long-fin/);
});

test('does not create new forums for unknown named breeders', async () => {
  const { guild, events } = guildWithForums(['tarumi-medaka', 'unknown-breeders']);
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [{ ...strain, breederName: 'Unlisted Medaka' }] });
  assert.equal(result.posted, 0);
  assert.equal(result.skipped, 1);
  assert.equal(events.length, 0);
});

test('unknown breeder uses existing unknown-breeders forum when explicitly routed', async () => {
  const { guild, events } = guildWithForums(['unknown-breeders']);
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [{ ...strain, breederName: null, breederForumName: 'unknown-breeders' }] });
  assert.equal(result.posted, 1);
  assert.equal(events[0].forumName, 'unknown-breeders');
});

test('does not post in unrelated forums with same name outside breeder category', async () => {
  const { guild } = guildWithForums(['tarumi-medaka']);
  guild.channels.cache.get('tarumi-medaka').parentId = 'different-category';
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain] });
  assert.equal(result.posted, 0);
});
