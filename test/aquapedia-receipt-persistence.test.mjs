import test from 'node:test';
import assert from 'node:assert/strict';
import * as posts from '../src/aquapedia-posts.mjs';

test('verified Discord message receipts are durably written to existing research job', async () => {
  assert.equal(typeof posts.persistVerifiedReceipts, 'function');
  const calls = [];
  const store = { async recordResearchJob(x) { calls.push(x); return x; } };
  const receipts = [{ recordId: 'galactic-shrimps', threadId: '123', messageId: '456', verified: true }];
  const r = await posts.persistVerifiedReceipts(store, 'job-1', { posted: 1, receipts, unverified: 0 });
  assert.equal(r.recorded, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'job-1');
  assert.deepEqual(calls[0].discordPublicationReceipts, receipts);
});

test('unverified or empty receipts are not persisted as completed', async () => {
  assert.equal(typeof posts.persistVerifiedReceipts, 'function');
  const store = { async recordResearchJob() { throw new Error('unverified receipt should not be stored'); } };
  const r = await posts.persistVerifiedReceipts(store, 'job-2', { posted: 0, receipts: [], unverified: 1 });
  assert.equal(r.recorded, 0);
});

test('verified receipts fail closed if research store cannot persist', async () => {
  assert.equal(typeof posts.persistVerifiedReceipts, 'function');
  await assert.rejects(() => posts.persistVerifiedReceipts(null, 'job-3', { posted: 1, receipts: [{ recordId: 'skyfish', threadId: 't', messageId: 'm', verified: true }] }));
});
