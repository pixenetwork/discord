import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaPost, publishAquapediaCards } from '../src/aquapedia-posts.mjs';

const breeder = { id: 'BREEDER-1', entityType: 'breeder', name: 'Yumemitsuki Medaka', japaneseName: '夢見月めだか', description: 'Tochigi ornamental medaka breeder', history: 'Named founder Kaneko, founder-cross history is source reported', sources: ['https://piscesbook.com/archives/25289'], confidence: 'Reported by publisher', photos: [
  { url: 'https://example.com/owned.jpg', reuseStatus: 'owner_owned', credit: 'Breeder; approved', view: 'side' },
  { url: 'https://example.com/portrait.png', reuseStatus: 'permission_granted', credit: 'Breeder; portrait', view: 'top' },
  { url: 'https://example.com/unlicensed.jpg', reuseStatus: 'unknown', credit: 'Third party' },
] };
const strain = { id: 'STRAIN-1', entityType: 'strain', name: 'Flower of Phoenix', japaneseName: 'フラワーオブフェニックス', breederName: 'Yumemitsuki Medaka', lineage: 'Arcana Lava Flame ex Long Fin × Flare Flower ex Long Fin', description: 'Red long-fin, glow-body expression', confidence: 'Reported; not DNA-verified', sources: ['https://piscesbook.com/archives/25276'] };

test('breeder card contains substantive information and approved inline photos, excluding unlicensed images', () => {
  const result = buildAquapediaPost(breeder);
  assert.match(result.embeds[0].description, /夢見月/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Origins \/ development history').value, /Kaneko/);
  assert.equal(result.embeds[0].image.url, 'https://example.com/owned.jpg');
  assert.equal(result.embeds[1].image.url, 'https://example.com/portrait.png');
  assert.equal(result.embeds.length, 2);
  assert.equal(result.allowedMentions.parse.length, 0);
  assert.ok(result.embeds[0].fields.find((v) => v.name === 'Research sources').value.includes('piscesbook'));
});

test('strain card includes lineage, uncertainty and an explicit missing-photo notice', () => {
  const result = buildAquapediaPost(strain);
  assert.match(result.content, /pending documented reuse permission/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Lineage \/ parent crosses').value, /Arcana Lava Flame/);
  assert.match(result.embeds[0].fields.find((v) => v.name === 'Evidence confidence').value, /not DNA-verified/);
  assert.ok(!result.embeds[0].image);
});

test('rejects malformed source and internal photo urls', () => {
  const result = buildAquapediaPost({ ...strain, photos: [
    { url: 'http://example.com/fish.jpg', credit: 'Owner', reuseStatus: 'owner_owned' },
    { url: 'https://localhost/fish.jpg', credit: 'Owner', reuseStatus: 'owner_owned' },
  ], sources: ['javascript:alert(1)', 'http://example.com/old'] });
  assert.equal(result.embeds.length, 1);
  assert.ok(!result.embeds[0].image);
  assert.equal(result.embeds[0].fields.find((f) => f.name === 'Research sources').value, 'Original-source citation pending');
});

test('does not post unreviewed or queued research', async () => {
  const result = await publishAquapediaCards({}, { status: 'completed', discordPublicationApproved: false, cards: [breeder] });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'review_or_completion_pending');
});

test('breeder and strain appear in same thread in source order with embed image', async () => {
  const events = [];
  const thread = { id: 'thread-1', name: breeder.name, archived: false, async send(payload) { events.push({ op: 'send', payload }); } };
  const forum = { type: 15, name: '🧬・breeder-strains', threads: {
    async fetchActive() { return { threads: new Map() }; },
    async fetchArchived() { return { threads: new Map() }; },
    async create({ name, message }) {
      events.push({ op: 'create', name, message });
      return thread;
    },
  } };
  const guild = { channels: { cache: { find(predicate) { return predicate(forum) ? forum : undefined; } } } };
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [strain, breeder] });
  assert.equal(result.posted, 2);
  assert.deepEqual(events.map((e) => e.op), ['create', 'send']);
  assert.equal(events[0].name, breeder.name);
  assert.equal(events[0].message.embeds[0].image.url, 'https://example.com/owned.jpg');
  assert.match(events[1].payload.embeds[0].fields.find((f) => f.name === 'Lineage \/ parent crosses').value, /Flare Flower/);
});

test('never invents a breeder thread when strain attribution is absent', async () => {
  const forum = { type: 15, name: '🧬・breeder-strains', threads: { async fetchActive() { return { threads: new Map() }; }, async fetchArchived() { return { threads: new Map() }; } } };
  const guild = { channels: { cache: { find() { return forum; } } } };
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [{ ...strain, breederName: null }] });
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'missing_breeder_attribution');
});
