import test from 'node:test';
import assert from 'node:assert/strict';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';

function fixture(hasBotPost) {
  const actions = [];
  const card = { id: 'breeder-skyfish', entityType: 'breeder', organismGroup: 'shrimp', name: 'Skyfish', sources: ['https://skyfish-aqua.com/'] };
  const post = {
    id: 'post-42', author: { id: 'our-bot' },
    embeds: [{ footer: { text: 'Aquapedia • breeder-skyfish • photos pending rights review' } }],
    async edit(payload) { actions.push({ type: 'edit', payload }); },
  };
  const thread = {
    id: 'thread-42', name: 'Breeder profile — Skyfish', archived: false,
    messages: { async fetch() { return new Map(hasBotPost ? [['post-42', post]] : []); } },
    async send(payload) { actions.push({ type: 'send', payload }); },
  };
  const forum = {
    id: 'forum-skyfish', type: 15, name: 'skyfish', parentId: 'research-cat',
    threads: {
      async fetchActive() { return { threads: new Map([['thread-42', thread]]) }; },
      async fetchArchived() { return { threads: new Map() }; },
      async create() { throw new Error('must not create a second thread'); }
    }
  };
  const category = { id: 'research-cat', type: 4, name: '🔬・BREEDER RESEARCH' };
  const guild = {
    client: { user: { id: 'our-bot' } },
    channels: { cache: new Map([['cat', category], ['forum', forum]]) }
  };
  return { guild, card, actions };
}

test('existing bot-owned breeder profile is edited rather than appended again', async () => {
  const { guild, card, actions } = fixture(true);
  await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [card] });
  assert.deepEqual(actions.map(x => x.type), ['edit']);
});

test('existing matching thread without bot-owned dossier fails closed', async () => {
  const { guild, card, actions } = fixture(false);
  const result = await publishAquapediaCards(guild, { status: 'completed', discordPublicationApproved: true, cards: [card] });
  assert.equal(actions.length, 0);
  assert.equal(result.skipped, 1);
});
