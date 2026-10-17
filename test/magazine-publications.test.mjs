import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelType } from 'discord.js';
import {
  MAGAZINE_ISSUES, buildMagazinePayload,
  locatePublicMagazineForum, publishMagazineIssues,
} from '../src/magazine-publications.mjs';

test('builds two rights-aware, source-linked posts indexing all 24 subjects', () => {
  assert.equal(MAGAZINE_ISSUES.length, 2);
  assert.equal(MAGAZINE_ISSUES.reduce((n, issue) => n + issue.topics.length, 0), 24);
  for (const issue of MAGAZINE_ISSUES) {
    const result = buildMagazinePayload(issue);
    assert.ok(result.content.length < 2000);
    assert.deepEqual(result.allowedMentions, { parse: [] });
    assert.equal(result.embeds.length, 1);
    assert.ok(result.embeds[0].fields.every((field) => field.value.length <= 1024));
    assert.ok(result.embeds[0].footer.text.includes(issue.id));
    assert.ok(result.embeds[0].description.includes(issue.sourceUrl));
    assert.ok(!JSON.stringify(result).includes('<img'));
    assert.ok(!JSON.stringify(result).includes('.pdf'));
    assert.ok(result.embeds[0].fields[0].value.includes('#section-1'));
  }
});

function simulatedGuild({ publicParent = true, initialForum = false } = {}) {
  const collection = new Map();
  const parent = { id: 'parent', name: '📘・AQUAPEDIA', type: ChannelType.GuildCategory };
  collection.set(parent.id, parent);
  let threads = [];
  let threadNum = 0;
  let forum = null;
  function newForum() {
    const topic = {
      id: 'forum-1', name: 'magazines-articles', parentId: parent.id,
      type: ChannelType.GuildForum, fetch: async () => forum,
      threads: {
        fetchActive: async () => ({ threads: new Map(threads.map(t => [t.id,t])) }),
        fetchArchived: async () => ({ threads: new Map(), hasMore: false }),
        create: async ({ name, message }) => {
          const id = String(++threadNum);
          const starter = {
            id: id + 'msg', author: { id: 'bot' }, embeds: message.embeds,
            edit: async (payload) => { starter.embeds = payload.embeds; },
          };
          const t = {
            id, name, ownerId: 'bot', archived: false,
            fetchStarterMessage: async () => starter,
          };
          threads.push(t);
          return t;
        },
      },
    };
    forum = topic;
    collection.set(topic.id, topic);
    return topic;
  }
  if (initialForum) newForum();
  const guild = {
    id: 'guild-1', client: { user: { id: 'bot' } },
    channels: {
      cache: collection,
      fetch: async () => collection,
      create: async opts => {
        assert.equal(opts.parent, parent.id);
        assert.equal(opts.type, ChannelType.GuildForum);
        return newForum();
      },
    },
    roles: {
      everyone: {
        permissionsIn: obj => ({ has: () => publicParent }),
      },
      fetch: async () => {},
    },
  };
  return { guild, collection, getThreads: () => threads };
}

test('does not post when public forum is missing and creation not permitted', async () => {
  const { guild } = simulatedGuild();
  const r = await publishMagazineIssues(guild);
  assert.equal(r.posted, 0);
  assert.equal(r.receipts.length, 0);
  assert.equal(r.blocker, 'Public forum not provisioned');
});

test('refuses private category instead of exposing restricted material', async () => {
  const { guild } = simulatedGuild({ publicParent: false });
  await assert.rejects(locatePublicMagazineForum(guild, { createIfMissing: true }), /private/);
});

test('publishes both original English issue guides with receipts, then updates without duplicate posts', async () => {
  const { guild, getThreads } = simulatedGuild();
  const first = await publishMagazineIssues(guild, { createForum: true });
  assert.equal(first.posted, 2);
  assert.equal(first.updated, 0);
  assert.equal(first.receipts.length, 2);
  assert.ok(first.receipts.every(r => r.verified && r.messageId && r.threadId));
  assert.equal(getThreads().length, 2);
  const second = await publishMagazineIssues(guild, { createForum: false });
  assert.equal(second.posted, 0);
  assert.equal(second.updated, 2);
  assert.equal(getThreads().length, 2);
});

test('refuses a colliding human-created thread', async () => {
  const { guild, getThreads } = simulatedGuild({ initialForum: true });
  const starter = { id:'human-msg', author:{id:'human'},embeds:[] };
  getThreads().push({
    id:'human-thread',name:MAGAZINE_ISSUES[0].threadName,ownerId:'human',
    fetchStarterMessage:async()=>starter,
  });
  await assert.rejects(publishMagazineIssues(guild), /not owned by bot/);
});
