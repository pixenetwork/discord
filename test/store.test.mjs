import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';

test('vendor ownership is isolated and payout events are idempotent', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-discord-'));
  try {
    const store = createStore({ dataDir });
    await store.upsertVendor({ id: 'toa', discordUserId: '100', displayName: 'TOA', catalogSlug: 'toa' });
    await store.upsertVendor({ id: 'mimu', discordUserId: '200', displayName: 'MIMU', catalogSlug: 'mimu' });
    await store.setProductOwner('gid://shopify/Product/123', 'toa');

    assert.equal((await store.getVendorByDiscordUser('100')).id, 'toa');
    assert.equal(await store.getProductOwner('gid://shopify/Product/123'), 'toa');
    await assert.doesNotReject(() => store.assertProductOwnership('gid://shopify/Product/123', 'toa'));
    await assert.rejects(() => store.assertProductOwnership('gid://shopify/Product/123', 'mimu'), /does not belong/);
    await assert.rejects(
      () => store.setProductOwner('gid://shopify/Product/123', 'mimu'),
      /explicit reconciliation is required/,
    );

    const payout = { id: 'owed:1:toa', vendorId: 'toa', orderId: '1', amountCents: 10500, type: 'owed' };
    await store.appendPayout(payout);
    await store.appendPayout(payout);
    const summary = await store.payoutSummary('toa');
    assert.equal(summary.owedCents, 10500);
    assert.equal(summary.entries.length, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('ticket and owed payout are recorded together and paid transition is atomic', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-discord-'));
  try {
    const store = createStore({ dataDir });
    const key = 'shopify:1:toa';
    await store.recordTicketWithPayout({
      key,
      vendorId: 'toa',
      channelId: 'discord-channel-1',
      orderId: '1',
      orderName: '#1001',
      payoutCents: 10500,
      status: 'awaiting_fulfillment',
    }, {
      id: 'owed:1:toa',
      vendorId: 'toa',
      orderId: '1',
      amountCents: 10500,
      type: 'owed',
    });

    const first = await store.markTicketPayoutPaid(key, { vendorId: 'toa' });
    const duplicate = await store.markTicketPayoutPaid(key, { vendorId: 'toa' });
    const summary = await store.payoutSummary('toa');
    const ticket = await store.getTicket(key);

    assert.equal(first.alreadyPaid, false);
    assert.equal(duplicate.alreadyPaid, true);
    assert.equal(summary.owedCents, 10500);
    assert.equal(summary.paidCents, 10500);
    assert.equal(summary.balanceCents, 0);
    assert.equal(summary.entries.length, 2);
    assert.equal(ticket.payoutStatus, 'paid');
    assert.ok(ticket.payoutPaidAt);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
