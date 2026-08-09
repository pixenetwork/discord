import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ChannelType, Collection } from 'discord.js';
import { createOrderService } from '../src/orders.mjs';
import { createStore } from '../src/store.mjs';

function mockGuild() {
  let roleSequence = 0;
  let channelSequence = 0;
  let messageSequence = 0;
  const roleCache = new Collection();
  const channelCache = new Collection();

  const guild = {
    roles: {
      cache: roleCache,
      everyone: { id: 'everyone' },
      async create({ name }) {
        const role = { id: `role-${++roleSequence}`, name };
        roleCache.set(role.id, role);
        return role;
      },
    },
    channels: {
      cache: channelCache,
      async create(input) {
        const messages = new Collection();
        const channel = {
          id: `channel-${++channelSequence}`,
          name: input.name,
          type: input.type,
          parentId: input.parent ?? null,
          topic: input.topic ?? null,
          permissionOverwrites: {
            async set() {},
          },
          messages: {
            async fetch() {
              return messages;
            },
          },
          async setTopic(topic) {
            channel.topic = topic;
            return channel;
          },
          async send(payload) {
            const message = {
              id: `message-${++messageSequence}`,
              embeds: (payload?.embeds ?? []).map((embed) => embed.data ?? embed),
            };
            messages.set(message.id, message);
            return message;
          },
          isTextBased() {
            return input.type === ChannelType.GuildText;
          },
        };
        channelCache.set(channel.id, channel);
        return channel;
      },
    },
    members: {
      async fetch() {
        return {
          roles: {
            async add() {},
          },
        };
      },
    },
  };

  return guild;
}

test('paid-order retry preserves ticket lifecycle, channel, and deterministic payout', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-orders-'));
  try {
    const store = createStore({ dataDir });
    await store.upsertVendor({
      id: 'toa',
      discordUserId: 'vendor-user',
      displayName: 'TOA',
      catalogSlug: 'toa',
      active: true,
    });
    let fulfillmentCalls = 0;
    const shopify = {
      gidForNumericProductId: (id) => `gid://shopify/Product/${id}`,
      gidForNumericOrderId: (id) => `gid://shopify/Order/${id}`,
      async getVendorMetadata() {
        return {
          vendorId: 'toa',
          vendorPriceCents: 10000,
          vendorShippingCents: 3000,
          title: 'Test Medaka',
        };
      },
      async fulfillVendorItems() {
        fulfillmentCalls += 1;
        return [{ id: 'unexpected-duplicate-fulfillment' }];
      },
    };
    const service = createOrderService({
      config: { discord: { ownerUserId: 'owner-user' } },
      store,
      shopify,
    });
    const guild = mockGuild();
    const order = {
      id: 12345,
      name: '#1001',
      line_items: [{ product_id: 777, title: 'Test Medaka', quantity: 1 }],
      shipping_address: { first_name: 'Test', last_name: 'Customer', city: 'Slidell' },
    };

    const first = await service.routePaidOrder(guild, order);
    const shippedAt = '2026-08-09T00:00:00.000Z';
    await store.recordTicket({
      ...first.tickets[0],
      status: 'shipped',
      trackingNumber: 'TRACK-1',
      fulfillmentIds: ['gid://shopify/Fulfillment/1'],
      shippedAt,
    });
    const retry = await service.routePaidOrder(guild, order);
    const replayedShipped = await store.getTicket('shopify:12345:toa');
    const duplicateShip = await service.markShipped(guild, {
      vendorId: 'toa',
      orderName: '#1001',
      trackingNumber: 'TRACK-2',
    });

    const issueAt = '2026-08-09T01:00:00.000Z';
    await store.recordTicket({
      ...replayedShipped,
      status: 'issue',
      issue: 'Carrier pickup failed',
      issueAt,
    });
    const issueRetry = await service.routePaidOrder(guild, order);
    const replayedIssue = await store.getTicket('shopify:12345:toa');

    const orderChannels = [...guild.channels.cache.values()].filter((channel) => (
      channel.type === ChannelType.GuildText
      && String(channel.topic ?? '').includes('Aquaphoria ticket key: shopify:12345:toa')
    ));
    const summary = await store.payoutSummary('toa');
    assert.equal(first.tickets.length, 1);
    assert.equal(retry.tickets.length, 1);
    assert.equal(issueRetry.tickets.length, 1);
    assert.equal(orderChannels.length, 1);
    assert.match(orderChannels[0].topic, /state=notified/);
    assert.equal(replayedShipped.status, 'shipped');
    assert.equal(replayedShipped.trackingNumber, 'TRACK-1');
    assert.deepEqual(replayedShipped.fulfillmentIds, ['gid://shopify/Fulfillment/1']);
    assert.equal(replayedShipped.shippedAt, shippedAt);
    assert.equal(duplicateShip.status, 'shipped');
    assert.equal(fulfillmentCalls, 0);
    assert.equal(replayedIssue.status, 'issue');
    assert.equal(replayedIssue.issue, 'Carrier pickup failed');
    assert.equal(replayedIssue.issueAt, issueAt);
    assert.equal(summary.owedCents, 13000);
    assert.equal(summary.entries.filter((entry) => entry.type === 'owed').length, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
