import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';

test('pending product drafts persist idempotently by submission id', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:ticket-1', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', fields: { name: 'Blue Dream' } };
    await store.saveProductSubmission(draft);
    await store.saveProductSubmission(draft, { expectedStatuses: ['pending'] });

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
      /belongs to another vendor|conflicting vendor ownership/,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});


test('product approval claim serializes concurrent reviewers and stale leases recover', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    await store.saveProductSubmission({ id: 'product:lease-1', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending' });
    const first = await store.claimProductApproval('product:lease-1', { now: new Date('2026-09-07T07:00:00Z'), leaseMs: 60_000 });
    const concurrent = await store.claimProductApproval('product:lease-1', { now: new Date('2026-09-07T07:00:30Z'), leaseMs: 60_000 });
    const recovered = await store.claimProductApproval('product:lease-1', { now: new Date('2026-09-07T07:02:00Z'), leaseMs: 60_000 });
    assert.equal(first.claimed, true);
    assert.equal(concurrent.claimed, false);
    assert.equal(concurrent.reason, 'processing');
    assert.equal(recovered.claimed, true);
    assert.equal(recovered.record.approvalAttempt, 2);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('product approval completion is idempotent and failure releases claim to pending', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    await store.saveProductSubmission({ id: 'product:lease-2', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending' });
    const first = await store.claimProductApproval('product:lease-2');
    const failed = await store.failProductApproval('product:lease-2', new Error('shopify down'), { approvalAttempt: first.record.approvalAttempt });
    assert.equal(failed.status, 'pending');
    const retry = await store.claimProductApproval('product:lease-2');
    assert.equal(retry.claimed, true);
    const completed = await store.completeProductApproval('product:lease-2', { shopifyProductId: 'gid://shopify/Product/9', shopifyHandle: 'toa-blue' }, { approvalAttempt: retry.record.approvalAttempt });
    const duplicate = await store.claimProductApproval('product:lease-2');
    assert.equal(completed.status, 'approved');
    assert.equal(completed.shopifyProductId, 'gid://shopify/Product/9');
    assert.equal(duplicate.claimed, false);
    assert.equal(duplicate.reason, 'approved');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('expected-status write cannot overwrite an in-flight approval claim', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:cas-1', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', fields: { name: 'A' } };
    await store.saveProductSubmission(draft);
    await assert.rejects(() => store.saveProductSubmission({ ...draft, fields: { changed: true } }), /expected status|blind write/i);
    await store.claimProductApproval(draft.id);
    await assert.rejects(
      () => store.saveProductSubmission({ ...draft, status: 'pending', fields: { name: 'B' } }, { expectedStatuses: ['draft', 'pending', 'changes_requested'] }),
      /state changed|approval_processing/,
    );
    const saved = await store.getProductSubmission(draft.id);
    assert.equal(saved.status, 'approval_processing');
    assert.equal(saved.fields.name, 'A');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('blind writes cannot overwrite protected product submission states', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:protected', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending' };
    await store.saveProductSubmission(draft);
    const claim = await store.claimProductApproval(draft.id);
    await assert.rejects(() => store.saveProductSubmission({ ...draft, status: 'pending' }), /protected|approval_processing|expected status/i);
    await store.completeProductApproval(draft.id, { shopifyProductId: 'gid://shopify/Product/9' }, { approvalAttempt: claim.record.approvalAttempt });
    await assert.rejects(() => store.saveProductSubmission({ ...draft, status: 'pending' }), /protected|approved|expected status/i);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('legacy submission without stored vendor ownership cannot be claimed', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    await writeFile(store.statePath, JSON.stringify({
      version: 2,
      productSubmissions: { legacy: { id: 'legacy', submitterDiscordId: '100', type: 'livestock', status: 'draft' } },
    }), 'utf8');
    await assert.rejects(
      () => store.saveProductSubmission({ id: 'legacy', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'draft' }, { expectedStatuses: ['draft'] }),
      /vendor|owner|ownership/i,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('stale approval holder cannot complete or fail after lease recovery', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:lease-owner', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending' };
    await store.saveProductSubmission(draft);
    const first = await store.claimProductApproval(draft.id, { now: new Date('2026-09-07T00:00:00Z'), leaseMs: 1000 });
    const second = await store.claimProductApproval(draft.id, { now: new Date('2026-09-07T00:00:02Z'), leaseMs: 1000 });
    await assert.rejects(() => store.completeProductApproval(draft.id, { shopifyProductId: 'old' }, { approvalAttempt: first.record.approvalAttempt }), /stale|claim|attempt/i);
    await assert.rejects(() => store.failProductApproval(draft.id, new Error('old failure'), { approvalAttempt: first.record.approvalAttempt }), /stale|claim|attempt/i);
    const saved = await store.completeProductApproval(draft.id, { shopifyProductId: 'new' }, { approvalAttempt: second.record.approvalAttempt });
    assert.equal(saved.status, 'approved');
    assert.equal(saved.shopifyProductId, 'new');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('stale publishing approval requires reconciliation instead of automatic retry', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-product-'));
  try {
    const store = createStore({ dataDir });
    const draft = { id: 'product:publishing', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending' };
    await store.saveProductSubmission(draft);
    const claim = await store.claimProductApproval(draft.id, { now: new Date('2026-09-07T00:00:00Z'), leaseMs: 1000 });
    await store.markProductApprovalPublishing(draft.id, { approvalAttempt: claim.record.approvalAttempt, now: new Date('2026-09-07T00:00:00Z') });
    const retry = await store.claimProductApproval(draft.id, { now: new Date('2026-09-07T00:00:02Z'), leaseMs: 1000 });
    assert.equal(retry.claimed, false);
    assert.equal(retry.reason, 'reconciliation_required');
    assert.equal(retry.existing.approvalPhase, 'publishing');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});