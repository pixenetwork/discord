import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityType, PermissionFlagsBits } from 'discord.js';
import { snapshotFiveMPlayers, presenceExcludedByRole } from '../src/fivem-presence.mjs';
import { loadConfig, assertDiscordConfig } from '../src/config.mjs';
import { createCommandRouter } from '../src/commands.mjs';

const guildId = '987654321098765432';
const ownerId = '123456789012345678';
const memberId = '234567890123456789';
const optOutId = '345678901234567890';
const playing = (userId) => ({ userId, status: 'online', activities: [{ name: 'FiveM', type: ActivityType.Playing }] });

test('Role opt-out excludes matching presences from public counts and staff lists', () => {
  const guild = {
    presences: { cache: new Map([[ownerId, playing(ownerId)], [memberId, playing(memberId)]]) },
    members: { cache: new Map([
      [ownerId, { roles: { cache: new Map([['any', {}]]) } }],
      [memberId, { roles: { cache: new Map([[optOutId, {}]]) } }],
    ]) },
  };
  const current = snapshotFiveMPlayers(guild, { optOutRoleId: optOutId });
  assert.equal(current.observed, 1);
  assert.equal(current.players[0].userId, ownerId);
  assert.equal(presenceExcludedByRole(guild, playing(memberId), optOutId), true);
});

test('Presence reporting fails closed for member roles missing from Discord cache', () => {
  const guild = {
    presences: { cache: new Map([[ownerId, playing(ownerId)], [memberId, playing(memberId)]]) },
    members: { cache: new Map([[ownerId, { roles: { cache: new Map() } }]]) },
  };
  const result = snapshotFiveMPlayers(guild, { optOutRoleId: optOutId });
  assert.equal(result.observed, 1);
  assert.equal(result.excludedUnknown, 1);
  assert.deepEqual(result.players.map((item) => item.userId), [ownerId]);
});

test('Public FiveM command respects opt-out role', async () => {
  let response = null;
  const router = createCommandRouter({
    config: { discord: { guildId, ownerUserId: ownerId }, fivem: { enabled: true, matchTerms: ['fivem'], optOutRoleId: optOutId } },
  });
  const guild = {
    presences: { cache: new Map([[ownerId, playing(ownerId)], [memberId, playing(memberId)]]) },
    members: { cache: new Map([
      [ownerId, { roles: { cache: new Map([[optOutId, {}]]) } }],
      [memberId, { roles: { cache: new Map() } }],
    ]) },
  };
  await router.handle({
    commandName: 'fivem', isChatInputCommand: () => true, guild, guildId,
    user: { id: memberId }, options: { getSubcommand: () => 'online' },
    memberPermissions: { has: () => false },
    async reply(value) { response = value; },
  });
  assert.match(response.content, /activity: \*\*1\*\*/);
  assert.doesNotMatch(response.content, new RegExp(ownerId));
});

test('Individual users can choose to hide and show their game activity via Discord role', async () => {
  const transitions = [];
  const member = { roles: {
    async add(role) { transitions.push(['hide', role.id]); },
    async remove(role) { transitions.push(['show', role.id]); },
  } };
  const guild = { roles: { cache: new Map([[optOutId, { id: optOutId }]]) },
    members: { async fetch(id) { assert.equal(id, memberId); return member; } } };
  let output;
  const router = createCommandRouter({
    config: { discord: { guildId, ownerUserId: ownerId }, fivem: { enabled: false, optOutRoleId: optOutId } },
  });
  const interaction = {
    commandName: 'fivem', isChatInputCommand: () => true, guild, guildId,
    user: { id: memberId }, memberPermissions: { has: () => false },
    options: { getSubcommand: () => 'hide' },
    async reply(value) { output = value; },
  };
  await router.handle(interaction);
  assert.equal(output.ephemeral, true);
  assert.match(output.content, /excluded/);
  interaction.options.getSubcommand = () => 'show';
  await router.handle(interaction);
  assert.equal(output.ephemeral, true);
  assert.deepEqual(transitions, [['hide', optOutId], ['show', optOutId]]);
});

test('FiveM monitoring cannot activate unless an opt-out role ID exists', () => {
  const cfg = loadConfig({
    DISCORD_TOKEN: 'example', DISCORD_APPLICATION_ID: ownerId, AQUAPHORIA_GUILD_ID: guildId,
    AQUAPHORIA_OWNER_USER_ID: ownerId, AQUAPHORIA_FIVEM_ACTIVITY_ENABLED: 'true',
  });
  assert.throws(() => assertDiscordConfig(cfg), /opt-out Discord role ID/);
});
