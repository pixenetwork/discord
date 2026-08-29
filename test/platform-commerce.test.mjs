import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createCommerceEngine } from '../src/platform/commerce.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  customer_support: { canonicalRoleIds: { staff: 'support-staff', integration: 'commerce-integration' } },
  beverly_hills_rp: { canonicalRoleIds: { staff: 'bh-staff', integration: 'bh-commerce' } },
};

const identity = createTestIdentityAdapter();
const integration = bindActor(identity, 'customer_support', 'integration', ['commerce-integration']);
const staff = bindActor(identity, 'customer_support', 'staff-user', ['support-staff']);
const HMAC_SECRET = 'test-tebex-hmac-secret';

function signed(engine, payload) {
  return engine.signWebhookPayload(payload);
}

test('verified purchase grants entitlement only after valid Tebex HMAC', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const { rawBody, hmacSignature } = signed(engine, {
    transactionId: 't-1',
    subjectId: 'user-1',
    productIds: ['product-a'],
    amountCents: 5000,
    status: 'verified',
  });
  engine.recordTebexVerification({ actor: integration, rawBody, hmacSignature });
  assert.equal(engine.hasEntitlement({ actor: staff, subjectId: 'user-1', productId: 'product-a' }), true);
  assert.equal(engine.supportAccess({ actor: staff, subjectId: 'user-1', productId: 'product-a' }).allowed, true);
});

test('forged status=verified without valid HMAC does not grant entitlement', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const forgedBody = JSON.stringify({
    transactionId: 't-forged',
    subjectId: 'user-forged',
    productIds: ['product-x'],
    amountCents: 9999,
    status: 'verified',
  });
  assert.throws(() => engine.recordTebexVerification({
    actor: integration,
    rawBody: forgedBody,
    hmacSignature: 'deadbeef',
    status: 'verified',
  }), /Invalid Tebex HMAC/);
  assert.throws(() => engine.recordTebexVerification({
    actor: integration,
    transactionId: 't-forged',
    subjectId: 'user-forged',
    productIds: ['product-x'],
    status: 'verified',
  }), /rawBody must be a string|HMAC verification failed|rawBody and hmacSignature/);
  assert.equal(engine.hasEntitlement({ actor: staff, subjectId: 'user-forged', productId: 'product-x' }), false);
});

test('duplicate verification is idempotent only for matching verified payloads', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const payload = {
    transactionId: 't-2',
    subjectId: 'user-2',
    productIds: ['product-b'],
    amountCents: 1000,
    status: 'verified',
  };
  const firstSig = signed(engine, payload);
  const first = engine.recordTebexVerification({ actor: integration, ...firstSig });
  assert.deepEqual(engine.recordTebexVerification({ actor: integration, ...firstSig }), first);
  const conflict = signed(engine, { ...payload, subjectId: 'other' });
  assert.throws(() => engine.recordTebexVerification({ actor: integration, ...conflict }), /different verification evidence/);
});

test('manual review flags do not change entitlement automatically', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const { rawBody, hmacSignature } = signed(engine, {
    transactionId: 't-3',
    subjectId: 'user-3',
    productIds: ['product-c'],
    amountCents: 2500,
    status: 'verified',
  });
  engine.recordTebexVerification({ actor: integration, rawBody, hmacSignature });
  const flag = engine.createFraudFlag({ actor: staff, transactionId: 't-3', reason: 'Needs duplicate-order review', severity: 'high' });
  assert.equal(flag.status, 'open');
  assert.equal(engine.hasEntitlement({ actor: staff, subjectId: 'user-3', productId: 'product-c' }), true);
  engine.resolveFraudFlag({ actor: staff, flagId: flag.id, resolution: 'Reviewed and cleared' });
  assert.equal(engine.openFraudFlags({ actor: staff }).length, 0);
});

test('missing entitlement denies gated support', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const access = engine.supportAccess({ actor: staff, subjectId: 'unknown', productId: 'product-z' });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'entitlement_required');
});

test('transaction records remain tenant isolated', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const { rawBody, hmacSignature } = signed(engine, {
    transactionId: 't-4',
    subjectId: 'user-4',
    productIds: ['product-d'],
    amountCents: 1000,
    status: 'verified',
  });
  engine.recordTebexVerification({ actor: integration, rawBody, hmacSignature });
  const bhStaff = bindActor(identity, 'beverly_hills_rp', 'bh-staff-user', ['bh-staff']);
  assert.throws(() => engine.transaction({ actor: bhStaff, transactionId: 't-4' }), /Unknown transaction/);
  assert.equal(engine.transaction({ actor: staff, transactionId: 't-4' }).subjectId, 'user-4');
});

test('privileged commerce reads require verified actor and canonical roles', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const { rawBody, hmacSignature } = signed(engine, {
    transactionId: 't-read',
    subjectId: 'user-read',
    productIds: ['product-read'],
    amountCents: 1000,
    status: 'verified',
  });
  engine.recordTebexVerification({ actor: integration, rawBody, hmacSignature });
  engine.createFraudFlag({ actor: staff, transactionId: 't-read', reason: 'review', severity: 'low' });

  const emptyRoles = bindActor(identity, 'customer_support', 'empty', []);
  const lookalike = bindActor(identity, 'customer_support', 'lookalike', ['Staff', 'support-staff-lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.transaction({ actor: denied, transactionId: 't-read' }), /Authorization denied/);
    assert.throws(() => engine.entitlement({ actor: denied, subjectId: 'user-read', productId: 'product-read' }), /Authorization denied/);
    assert.throws(() => engine.hasEntitlement({ actor: denied, subjectId: 'user-read', productId: 'product-read' }), /Authorization denied/);
    assert.throws(() => engine.supportAccess({ actor: denied, subjectId: 'user-read', productId: 'product-read' }), /Authorization denied/);
    assert.throws(() => engine.openFraudFlags({ actor: denied }), /Authorization denied/);
  }
  assert.throws(() => engine.transaction({
    actor: { userId: 'spoof', tenantId: 'customer_support', roleIds: ['support-staff'] },
    transactionId: 't-read',
  }), /Unverified Discord identity/);
});

test('caller-supplied status cannot bypass HMAC even with matching sha256 digest', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const evidence = { eventId: 'e-1', status: 'verified' };
  const digest = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  assert.throws(() => engine.recordTebexVerification({
    actor: integration,
    transactionId: 't-digest',
    subjectId: 'user-digest',
    productIds: ['product-digest'],
    status: 'verified',
    sourceEvidence: evidence,
    sourceDigest: digest,
  }), /rawBody must be a string|HMAC verification failed|rawBody and hmacSignature/);
  assert.equal(engine.hasEntitlement({ actor: staff, subjectId: 'user-digest', productId: 'product-digest' }), false);
});

test('object rawBody fails closed even when hmacSignature is present', () => {
  const engine = createCommerceEngine({ authorization, hmacSecret: HMAC_SECRET });
  const payload = {
    transactionId: 't-obj',
    subjectId: 'user-obj',
    productIds: ['product-obj'],
    amountCents: 1000,
    status: 'verified',
  };
  const rawAsString = JSON.stringify(payload);
  const hmacSignature = crypto.createHmac('sha256', HMAC_SECRET).update(rawAsString).digest('hex');
  assert.throws(() => engine.recordTebexVerification({
    actor: integration,
    rawBody: payload,
    hmacSignature,
  }), /rawBody must be a string/);
  assert.equal(engine.hasEntitlement({ actor: staff, subjectId: 'user-obj', productId: 'product-obj' }), false);
});
