import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';

test('webhook idempotency prevents duplicate processing', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store = createStore({ dataDir });
    const webhookId = 'shopify:orders-paid:12345';

    const first = await store.claimWebhook(webhookId);
    assert.equal(first.claimed, true, 'first delivery should be claimed');
    assert.ok(first.record?.claimedAt, 'claim record should have timestamp');

    const duplicate = await store.claimWebhook(webhookId);
    assert.equal(duplicate.claimed, false, 'duplicate delivery must not be claimed');
    assert.ok(duplicate.existing?.claimedAt, 'existing record should be returned');

    const record = await store.getWebhookRecord(webhookId);
    assert.equal(record.id, webhookId);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('concurrent webhook claims are serialized and deduplicated', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store = createStore({ dataDir });
    const webhookId = 'shopify:orders-paid:99999';

    const [result1, result2, result3] = await Promise.all([
      store.claimWebhook(webhookId),
      store.claimWebhook(webhookId),
      store.claimWebhook(webhookId),
    ]);

    const claimed = [result1, result2, result3].filter((result) => result.claimed);
    const rejected = [result1, result2, result3].filter((result) => !result.claimed);

    assert.equal(claimed.length, 1, 'exactly one concurrent request must succeed');
    assert.equal(rejected.length, 2, 'other concurrent requests must be rejected as duplicates');

    for (const result of rejected) {
      assert.ok(result.existing?.claimedAt, 'rejected claims must receive the existing record');
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('restart after crash preserves webhook state', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store1 = createStore({ dataDir });
    const webhookId = 'shopify:orders-paid:77777';

    const first = await store1.claimWebhook(webhookId);
    assert.equal(first.claimed, true, 'first claim before restart should succeed');

    const store2 = createStore({ dataDir });
    const afterRestart = await store2.claimWebhook(webhookId);
    assert.equal(afterRestart.claimed, false, 'duplicate after restart must be rejected');
    assert.ok(afterRestart.existing?.claimedAt, 'persisted record must survive restart');

    const reloaded = await store2.getWebhookRecord(webhookId);
    assert.equal(reloaded.id, webhookId, 'webhook record must be durable across restarts');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('malformed webhook ID is rejected', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-webhooks-'));
  try {
    const store = createStore({ dataDir });

    await assert.rejects(
      () => store.claimWebhook(null),
      /Webhook ID is required/,
      'null webhook ID must throw',
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
