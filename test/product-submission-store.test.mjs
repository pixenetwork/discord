import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';

test('pending product drafts persist idempotently by submission id', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:ticket-1', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', fields: { name: 'Blue Dream' } };
    await store.saveProductSubmission(draft);
    await store.saveProductSubmission(draft);

    const saved = await store.getProductSubmission(draft.id);
    const listed = await store.listProductSubmissions({ vendorId: 'toa' });
    assert.equal(saved.vendorId, 'toa');
    assert.equal(listed.length, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('a product submission id cannot be taken over by another vendor', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    await store.saveProductSubmission({ id: 'product:ticket-2', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock' });
    await assert.rejects(
      () => store.saveProductSubmission({ id: 'product:ticket-2', vendorId: 'mimu', submitterDiscordId: '200', type: 'livestock' }),
      /belongs to another vendor/,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
