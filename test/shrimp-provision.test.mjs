import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionShrimpPublicResearchForum, layoutDefinition } from '../src/layout.mjs';
import { PermissionFlagsBits } from 'discord.js';

function guildFixture({ publicCategory = true, historyReadable = true, hasCategory = true } = {}) {
  const writes = [];
  const everyone = { id: 'everyone' };
  const cat = { id: '1561430495680667719', type: 4, name: '🧬・AQUAPEDIA — SPECIES & GENETICS',
    permissionsFor(role) { return { has(flag) { return role === everyone && publicCategory && (flag !== PermissionFlagsBits.ReadMessageHistory || historyReadable); } }; } };
  const spec = layoutDefinition().find(s => s.category === '🧬・AQUAPEDIA — SPECIES & GENETICS').forums.find(x => x.name === '🦐・shrimp-research');
  const forum = {
    id: spec.id, type: 15, parentId: cat.id, name: spec.name, topic: spec.topic,
    availableTags: spec.tags.map((tag,idx) => ({...tag,id:'tag-'+idx})),
    permissionsFor() { return { has(flag) { return publicCategory && (flag !== PermissionFlagsBits.ReadMessageHistory || historyReadable); } }; },
  };
  const channels = hasCategory ? [cat,forum] : [];
  return { writes, guild: {
    roles: { everyone },
    channels: {
      cache: { find(fn) { return channels.find(fn); }, filter(fn) { return { size: channels.filter(fn).length }; } },
      async create(input) {
        writes.push(input);
        return { id: 'forum-created', name: input.name,
          permissionsFor() { return { has(flag) { return publicCategory && (flag !== PermissionFlagsBits.ReadMessageHistory || historyReadable); } }; } };
      }
    }
  }};
}

test('reuses the existing public shrimp forum with exact IDs without creating another forum', async () => {
  const x = guildFixture();
  const response = await provisionShrimpPublicResearchForum(x.guild);
  assert.equal(response.status, 'ready');
  assert.equal(response.categoryId, '1561430495680667719');
  assert.equal(response.channelId, '1561189288090140743');
  assert.equal(x.writes.length, 0);
});

test('never creates a public forum underneath a private species category', async () => {
  const x = guildFixture({ publicCategory: false });
  const response = await provisionShrimpPublicResearchForum(x.guild);
  assert.equal(response.status, 'category_not_public');
  assert.equal(x.writes.length, 0);
});

test('does not create a second species category if the intended one is missing', async () => {
  const x = guildFixture({ hasCategory: false });
  const response = await provisionShrimpPublicResearchForum(x.guild);
  assert.equal(response.status, 'category_not_found');
  assert.equal(x.writes.length, 0);
});

test('does not provision a public forum when history is unreadable to everyone', async () => {
 const x=guildFixture({historyReadable:false});
 const r=await provisionShrimpPublicResearchForum(x.guild);
 assert.equal(r.status,'category_not_public');
 assert.equal(x.writes.length,0);
});
