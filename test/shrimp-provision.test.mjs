import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionShrimpPublicResearchForum } from '../src/layout.mjs';
import { PermissionFlagsBits } from 'discord.js';

function guildFixture({ publicCategory = true, historyReadable = true, hasCategory = true } = {}) {
  const writes = [];
  const everyone = { id: 'everyone' };
  const cat = { id: 'c', type: 4, name: '📚・AQUAPEDIA',
    permissionsFor(role) { return { has(flag) { return role === everyone && publicCategory && (flag !== PermissionFlagsBits.ReadMessageHistory || historyReadable); } }; } };
  const channels = hasCategory ? [cat] : [];
  return { writes, guild: {
    roles: { everyone },
    channels: {
      cache: { find(fn) { return channels.find(fn); } },
      async create(input) {
        writes.push(input);
        return { id: 'forum-created', name: input.name,
          permissionsFor() { return { has(flag) { return publicCategory && (flag !== PermissionFlagsBits.ReadMessageHistory || historyReadable); } }; } };
      }
    }
  }};
}

test('adds exactly one public shrimp forum under the existing public Aquapedia category', async () => {
  const x = guildFixture();
  const response = await provisionShrimpPublicResearchForum(x.guild);
  assert.equal(response.status, 'ready');
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].parent, 'c');
  assert.equal(x.writes[0].name, '🦐・shrimp-research');
  assert.equal(x.writes[0].type, 15);
  assert.match(x.writes[0].reason, /public shrimp research/i);
  assert.equal(x.writes[0].permissionOverwrites, undefined);
});

test('never creates a public forum underneath a private Aquapedia category', async () => {
  const x = guildFixture({ publicCategory: false });
  const response = await provisionShrimpPublicResearchForum(x.guild);
  assert.equal(response.status, 'category_not_public');
  assert.equal(x.writes.length, 0);
});

test('does not create a second Aquapedia category if the intended one is missing', async () => {
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
