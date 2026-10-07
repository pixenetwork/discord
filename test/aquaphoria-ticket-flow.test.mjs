import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';
import { createCommandRouter } from '../src/commands.mjs';

test('Aquaphoria ticket command exposes strain and freshwater support choices', () => {
  const router = createCommandRouter({
    config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } },
    store: {},
  });
  const ticket = router.definitions.find((command) => command.name === 'ticket');
  assert.ok(ticket);
  const open = ticket.options.find((option) => option.name === 'open');
  const type = open.options.find((option) => option.name === 'type');
  const values = new Set(type.choices.map((choice) => choice.value));
  for (const value of ['strain_request', 'order', 'fish_medaka', 'shrimp', 'general']) {
    assert.ok(values.has(value), `missing ticket choice ${value}`);
  }
});

test('strain request tickets are created privately under Request Desk', async () => {
  const created = [];
  const sent = [];
  let reply = null;
  const requestDesk = { id: 'request-desk', type: ChannelType.GuildCategory, name: '🔎・REQUEST DESK' };
  const staffRole = { id: 'staff-role', name: 'Aquaphoria Staff' };
  const guild = {
    roles: {
      everyone: { id: 'everyone' },
      cache: {
        get: (id) => id === 'staff-role' ? staffRole : undefined,
        filter: (predicate) => {
          const matches = [staffRole].filter(predicate);
          return { size: matches.length, first: () => matches[0] };
        },
      },
    },
    channels: {
      cache: { find: (predicate) => [requestDesk].find(predicate) },
      async create(options) {
        created.push(options);
        return { id: 'strain-ticket-1', async send(message) { sent.push(message); } };
      },
    },
  };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
  };
  const interaction = {
    user: { id: 'customer-1', username: 'keeper' },
    guild,
    commandName: 'ticket',
    isChatInputCommand: () => true,
    options: {
      getString: (name) => name === 'type' ? 'strain_request' : 'Ryurin medaka, pair if possible, budget $100',
    },
    async deferReply() { this.deferred = true; },
    async editReply(value) { reply = value; },
    async reply(value) { this.replied = true; reply = value?.content ?? value; },
  };
  const router = createCommandRouter({
    config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } },
    store,
  });

  await router.handle(interaction);

  assert.equal(created.length, 1);
  assert.equal(created[0].parent, 'request-desk');
  assert.match(created[0].name, /^ticket-strain-request-/);
  assert.match(String(sent[0]?.embeds?.[0]?.data?.title ?? ''), /STRAIN REQUEST/);
  assert.match(String(reply ?? ''), /strain-ticket-1/);
});
