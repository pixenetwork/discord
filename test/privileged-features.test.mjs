import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityType, PermissionFlagsBits } from 'discord.js';
import { matchesFiveMActivity, snapshotFiveMPlayers, formatFiveMPlayers } from '../src/fivem-presence.mjs';
import { detectMarketplaceRisks, createMarketplaceModeration } from '../src/marketplace-moderation.mjs';
import { trackJoinBurst, createMemberLifecycle } from '../src/member-lifecycle.mjs';
import { loadConfig, assertDiscordConfig } from '../src/config.mjs';
import { createCommandRouter } from '../src/commands.mjs';

const id = '123456789012345678';
const guildId = '987654321098765432';
const secondId = '234567890123456789';
const presence = (userId, name, state = 'online') => ({
  userId, status: state, activities: [{ type: ActivityType.Playing, name }],
});

test('FiveM activity includes only visible playing activities with matching names', () => {
  assert.ok(matchesFiveMActivity(presence(id, 'FiveM')));
  assert.equal(matchesFiveMActivity(presence(id, 'Minecraft')), null);
  assert.equal(matchesFiveMActivity(presence(id, 'FiveM', 'offline')), null);
  assert.equal(matchesFiveMActivity({ status: 'online', activities: [{ type: ActivityType.Custom, name: 'FiveM' }] }), null);
  assert.ok(matchesFiveMActivity(presence(id, 'Beverly Hills 90210 RP'), ['Beverly Hills 90210']));
});

test('FiveM activity snapshot lists current visible members only and notes limitations', () => {
  const guild = { presences: { cache: new Map([
    [id, presence(id, 'FiveM')], [secondId, presence(secondId, 'Roblox')], ['xxx', presence('xxx', 'FiveM')],
  ]) } };
  const result = snapshotFiveMPlayers(guild);
  assert.equal(result.observed, 1);
  assert.equal(result.players.length, 1);
  assert.match(formatFiveMPlayers(result), /not the actual FiveM/);
  assert.match(formatFiveMPlayers(result), new RegExp(id));
});

test('FiveM command remains disabled unless enabled and restricted to staff', async () => {
  let answer;
  const config = { discord: { guildId, ownerUserId: id }, fivem: { enabled: true, matchTerms: ['fivem'] } };
  const router = createCommandRouter({ config });
  const guild = { presences: { cache: new Map([[id, presence(id, 'FiveM')]]) } };
  const interaction = {
    user: { id: secondId }, guildId, guild, commandName: 'fivem', isChatInputCommand: () => true,
    memberPermissions: { has: (bit) => bit === PermissionFlagsBits.ManageGuild },
    async reply(value) { answer = value; },
  };
  await router.handle(interaction);
  assert.equal(answer.ephemeral, true);
  assert.match(answer.content, /FiveM activity currently visible/);
  assert.deepEqual(answer.allowedMentions.parse, []);
  config.fivem.enabled = false;
  await router.handle(interaction);
  assert.match(answer.content, /not enabled/);
});

test('FiveM public online report shares counts but not member identities', async () => {
  let reply;
  const config = { discord: { guildId, ownerUserId: id }, fivem: { enabled: true, matchTerms: ['fivem'] } };
  const router = createCommandRouter({ config });
  const interaction = {
    user: { id: secondId }, guildId,
    guild: { presences: { cache: new Map([[id, presence(id, 'FiveM')]]) } },
    commandName: 'fivem', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'online' }, memberPermissions: { has: () => false },
    async reply(value) { reply = value; },
  };
  await router.handle(interaction);
  assert.equal(reply.ephemeral, false);
  assert.match(reply.content, /visible FiveM game activity: \*\*1\*\*/);
  assert.doesNotMatch(reply.content, new RegExp(id));
});

test('FiveM cannot be viewed by nonstaff or other guilds', async () => {
  let replied;
  const router = createCommandRouter({ config: { discord: { guildId, ownerUserId: id }, fivem: { enabled: true, matchTerms: ['fivem'] } } });
  const interaction = {
    user: { id: secondId }, guildId, guild: {}, commandName: 'fivem', isChatInputCommand: () => true,
    memberPermissions: { has: () => false }, async reply(value) { replied = value; },
  };
  await router.handle(interaction);
  assert.match(replied.content, /server managers/);
  replied = null; interaction.guildId = '111111111111111111';
  await router.handle(interaction);
  assert.equal(replied, null);
});

test('Safety features and privileged intents default disabled', () => {
  const config = loadConfig({});
  assert.equal(config.memberSafety.enabled, false);
  assert.equal(config.moderation.enabled, false);
  assert.equal(config.fivem.enabled, false);
  assert.deepEqual(config.fivem.matchTerms, ['fivem']);
});

test('Marketplace checks blocked domains with subdomain boundaries and does not leak content', async () => {
  assert.deepEqual(detectMarketplaceRisks('https://not-example.test/path', { blockedDomains: ['example.test'] }), []);
  assert.deepEqual(detectMarketplaceRisks('https://evil.example.test', { blockedDomains: ['example.test'] }), ['Administrator-blocked link']);
  let notification;
  const guild = {
    id: guildId, roles: { everyone: { id: 'everyone' } },
    channels: { cache: new Map([['staff', {
      isTextBased: () => true, permissionsFor: () => ({ has: () => false }),
      async send(msg) { notification = msg; },
    }]]) },
  };
  const service = createMarketplaceModeration({ config: {
    discord: { guildId }, moderation: { enabled: true, channelIds: ['market'], alertChannelId: 'staff', blockedDomains: ['example.test'] },
  } });
  assert.equal(await service.onMessage({ guild, id, channelId: 'market', author: { id }, content: 'https://evil.example.test', url: 'https://discord.com/channels/123/456/789' }), true);
  assert.doesNotMatch(notification.content, /evil\.example\.test/);
  assert.deepEqual(notification.allowedMentions.parse, []);
});

test('Member join burst detection works in bounded window; events skip if disabled', async () => {
  const data = trackJoinBurst([100, 200], 201, { windowMs: 101, threshold: 2 });
  assert.equal(data.count, 2);
  assert.equal(data.burst, true);
  const service = createMemberLifecycle({
    config: { discord: { guildId }, memberSafety: { enabled: false, joinWindowSeconds: 60, burstThreshold: 25 } },
    store: { getVendorByDiscordUser: async () => null },
  });
  assert.equal(await service.onJoin({ guild: { id: guildId }, user: { bot: false }, id }), false);
});

test('Safety configuration rejects channel-less moderation before login', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'example', DISCORD_APPLICATION_ID: id, AQUAPHORIA_GUILD_ID: guildId, AQUAPHORIA_OWNER_USER_ID: secondId,
    AQUAPHORIA_MODERATION_ENABLED: 'true',
  });
  assert.throws(() => assertDiscordConfig(config), /explicit monitored channel IDs/);
});
