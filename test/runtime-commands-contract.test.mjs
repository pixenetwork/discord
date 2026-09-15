import test from 'node:test';
import assert from 'node:assert/strict';
import * as commands from '../src/commands.mjs';

test('Discord runtime command entrypoints used by index are exported', () => {
  assert.equal(typeof commands.registerGuildCommands, 'function');
  assert.equal(typeof commands.handleInteraction, 'function');
});


test('router catches async failures from non-product command handlers', async () => {
  let reply = null;
  const interaction = {
    user: { id: '100' }, guild: { channels: { cache: [] } },
    commandName: 'catalog', isChatInputCommand: () => true, deferred: false, replied: false,
    options: {
      getSubcommand: () => 'add',
      getString: (name) => ({ name: 'Blue Dream', category: 'live_fish', price: '12.00', shipping: '15.00' })[name] ?? null,
      getInteger: () => 10,
      getAttachment: () => null,
    },
    async deferReply() { this.deferred = true; },
    async editReply(value) { reply = value?.content ?? value; },
    async reply(value) { this.replied = true; reply = value?.content ?? value; },
  };
  const router = commands.createCommandRouter({
    config: { marketplace: { defaultMarkupPercent: 5 } },
    store: { async getVendorByDiscordUser() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa' }; } },
    catalog: { async add() { throw new Error('catalog exploded'); } },
  });
  await assert.doesNotReject(() => router.handle(interaction));
  assert.match(String(reply), /catalog exploded/);
});