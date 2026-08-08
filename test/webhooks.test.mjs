import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';
import { createPaidOrderWebhookHandler } from '../src/webhook-handler.mjs';

async function fixture(routePaidOrder = async () => undefined) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  const store = createStore({ dataDir });
  const logs = [];
  let routeCalls = 0;
  const handler = createPaidOrderWebhookHandler({
    shopify: { verifyWebhook: () => true },
    store,
    orders: {
      async routePaidOrder(guild, order) {
        routeCalls += 1;
        return routePaidOrder(guild, order);
      },
    },
    getGuild: async () => ({ id: 'guild' }),
    logError: async (message) => logs.push(message),
  });
  return {
    dataDir,
    store,
    handler,
    logs,
    routeCalls: () => routeCalls,
  };
}

test('malformed JSON after a valid HMAC returns 400 without routing or noisy logging', async () => {
  const context = await fixture();
  try {
    const result = await context.handler({
      rawBody: Buffer.from('{"id":', 'utf8'),
      hmac: 'valid',
    });

    assert.deepEqual(result, {
      statusCode: 400,
      body: { ok: false, error: 'invalid_json' },
    });
    assert.equal(context.routeCalls(), 0);
    assert.deepEqual(context.logs, []);
  } finally {
    await rm(context.dataDir, { recursive: true, force: true });
  }
});

test('successful routing completes the durable event before acknowledging duplicates', async () => {
  const context = await fixture();
  try {
    const request = {
      rawBody: Buffer.from('{"id":12345,"name":"#1001","line_items":[]}', 'utf8'),
      hmac: 'valid',
    };
    const first = await context.handler(request);
    const duplicate = await context.handler(request);

    assert.deepEqual(first, { statusCode: 200, body: { ok: true } });
    assert.deepEqual(duplicate, { statusCode: 200, body: { ok: true, duplicate: true } });
    assert.equal(context.routeCalls(), 1);
    const record = await context.store.getWebhookRecord('shopify:orders-paid:12345');
    assert.equal(record.status, 'completed');
    assert.equal(record.attempt, 1);
  } finally {
    await rm(context.dataDir, { recursive: true, force: true });
  }
});

test('routing failure returns 500 and the next delivery retries successfully', async () => {
  let shouldFail = true;
  const context = await fixture(async () => {
    if (shouldFail) {
      shouldFail = false;
      throw new Error('Discord temporarily unavailable');
    }
  });
  try {
    const request = {
      rawBody: Buffer.from('{"id":77777,"name":"#1002","line_items":[]}', 'utf8'),
      hmac: 'valid',
    };
    const failed = await context.handler(request);
    const failedRecord = await context.store.getWebhookRecord('shopify:orders-paid:77777');
    const retried = await context.handler(request);
    const completedRecord = await context.store.getWebhookRecord('shopify:orders-paid:77777');

    assert.equal(failed.statusCode, 500);
    assert.equal(failed.body.retry, true);
    assert.equal(failedRecord.status, 'failed');
    assert.deepEqual(retried, { statusCode: 200, body: { ok: true } });
    assert.equal(completedRecord.status, 'completed');
    assert.equal(completedRecord.attempt, 2);
    assert.equal(context.routeCalls(), 2);
  } finally {
    await rm(context.dataDir, { recursive: true, force: true });
  }
});

test('concurrent duplicate delivery receives a retryable response while the first is processing', async () => {
  let releaseRoute;
  let signalEntered;
  const entered = new Promise((resolve) => { signalEntered = resolve; });
  const release = new Promise((resolve) => { releaseRoute = resolve; });
  const context = await fixture(async () => {
    signalEntered();
    await release;
  });
  try {
    const request = {
      rawBody: Buffer.from('{"id":99999,"name":"#1003","line_items":[]}', 'utf8'),
      hmac: 'valid',
    };
    const firstPromise = context.handler(request);
    await entered;
    const concurrent = await context.handler(request);
    releaseRoute();
    const first = await firstPromise;

    assert.deepEqual(concurrent, {
      statusCode: 409,
      body: { ok: false, retry: true, error: 'webhook_in_progress' },
    });
    assert.deepEqual(first, { statusCode: 200, body: { ok: true } });
    assert.equal(context.routeCalls(), 1);
  } finally {
    await rm(context.dataDir, { recursive: true, force: true });
  }
});

test('a stale processing claim is recoverable after restart', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store1 = createStore({ dataDir });
    const webhookId = 'shopify:orders-paid:restart';
    const first = await store1.claimWebhook(webhookId, {
      now: '2026-08-08T20:00:00.000Z',
      leaseMs: 60_000,
    });
    assert.equal(first.claimed, true);

    const store2 = createStore({ dataDir });
    const stillLeased = await store2.claimWebhook(webhookId, {
      now: '2026-08-08T20:00:30.000Z',
      leaseMs: 60_000,
    });
    const reclaimed = await store2.claimWebhook(webhookId, {
      now: '2026-08-08T20:01:01.000Z',
      leaseMs: 60_000,
    });

    assert.equal(stillLeased.claimed, false);
    assert.equal(stillLeased.reason, 'processing');
    assert.equal(reclaimed.claimed, true);
    assert.equal(reclaimed.record.attempt, 2);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('malformed webhook ID is rejected', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store = createStore({ dataDir });
    await assert.rejects(() => store.claimWebhook(null), /Webhook ID is required/);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
