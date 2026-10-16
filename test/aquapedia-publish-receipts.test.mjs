import test from 'node:test';
import assert from 'node:assert/strict';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';

function buildForum({ mode = 'created', correctAuthor = true, readbackError = false } = {}) {
  const events = [];
  const card = {
    id: 'shrimp-breeder-galactic', entityType: 'breeder', organismGroup: 'shrimp',
    name: 'Galactic Shrimps', breederForumName: 'galactic-shrimps',
    sources: ['https://www.galacticshrimps.pl/en/']
  };
  const message = { id: 'msg-77', author: { id: correctAuthor ? 'aquapedia-bot' : 'unknown-user' },
    embeds: [{ footer: { text: 'Aquapedia • shrimp-breeder-galactic • photos pending rights review' } }],
    async edit(_payload) { events.push('edit'); return this; } };
  const thread = { id: 'thread-77', name: 'Breeder profile — Galactic Shrimps', archived: false,
    async fetchStarterMessage() { events.push('starter-readback'); if (readbackError) throw new Error('Discord readback unavailable'); return message; },
    messages: { async fetch(query) { events.push('message-readback'); if (typeof query === 'string') return message; return new Map([['msg-77', message]]); } }
  };
  const forum = { id: 'forum-4', type: 15, name: 'galactic-shrimps', parentId: 'research-category', threads: {
    async fetchActive() { return { threads: new Map(mode === 'existing' ? [['thread-77', thread]] : []) }; },
    async fetchArchived() { return { threads: new Map() }; },
    async create() { events.push('create'); return thread; }
  }};
  const category = { id: 'research-category', type: 4, name: '🔬・BREEDER RESEARCH' };
  const guild = { client: { user: { id: 'aquapedia-bot' } }, channels: {
    cache: new Map([['cat', category], ['forum', forum]]) } };
  return { guild, card, events };
}

test('new breeder post emits message-ID receipt only after bot-authored starter readback', async () => {
  const x = buildForum();
  const r = await publishAquapediaCards(x.guild, { status:'completed', discordPublicationApproved:true, cards:[x.card] });
  assert.equal(r.posted, 1);
  assert.equal(r.receipts.length, 1);
  assert.deepEqual(r.receipts[0], { recordId:'shrimp-breeder-galactic', threadId:'thread-77', messageId:'msg-77', verified:true });
  assert.ok(x.events.includes('starter-readback'));
});

test('a forum post with an unverified author is NOT counted as verified publication', async () => {
  const x = buildForum({ correctAuthor:false });
  const r = await publishAquapediaCards(x.guild, { status:'completed', discordPublicationApproved:true, cards:[x.card] });
  assert.equal(r.posted, 0);
  assert.equal(r.unverified, 1);
  assert.equal(r.receipts.length, 0);
});

test('existing bot-owned post emits receipt after editing and reading back', async () => {
  const x = buildForum({ mode:'existing' });
  const r = await publishAquapediaCards(x.guild, { status:'completed', discordPublicationApproved:true, cards:[x.card] });
  assert.equal(r.posted, 1);
  assert.equal(r.receipts[0].messageId, 'msg-77');
  assert.ok(x.events.includes('edit'));
  assert.ok(x.events.includes('message-readback'));
});

test('Discord readback outage records unverified publication without claiming success', async () => {
  const x = buildForum({ readbackError: true });
  const r = await publishAquapediaCards(x.guild, { status:'completed', discordPublicationApproved:true, cards:[x.card] });
  assert.equal(r.posted, 0);
  assert.equal(r.unverified, 1);
  assert.deepEqual(r.receipts, []);
});
