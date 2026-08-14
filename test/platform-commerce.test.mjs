import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommerceEngine } from '../src/platform/commerce.mjs';

const authorization = {
  customer_support: { canonicalRoleIds: { staff: 'support-staff', integration: 'commerce-integration' } },
  beverly_hills_rp: { canonicalRoleIds: { staff: 'bh-staff', integration: 'bh-commerce' } },
};

const integration = { userId: 'integration', tenantId: 'customer_support', roleIds: ['commerce-integration'] };
const staff = { userId: 'staff-user', tenantId: 'customer_support', roleIds: ['support-staff'] };

test('verified purchase grants entitlement and product support access', () => {
  const engine = createCommerceEngine({ authorization });
  engine.recordTebexVerification({ actor: integration, transactionId: 't-1', subjectId: 'user-1', productIds: ['product-a'], amountCents: 5000, status: 'verified', sourceEvidence: { eventId: 'e-1' } });
  assert.equal(engine.hasEntitlement('customer_support', 'user-1', 'product-a'), true);
  assert.equal(engine.supportAccess({ tenantId: 'customer_support', subjectId: 'user-1', productId: 'product-a' }).allowed, true);
});

test('duplicate verification is idempotent only for matching evidence', () => {
  const engine = createCommerceEngine({ authorization });
  const input = { actor: integration, transactionId: 't-2', subjectId: 'user-2', productIds: ['product-b'], amountCents: 1000, status: 'verified', sourceEvidence: { eventId: 'e-2' } };
  const first = engine.recordTebexVerification(input);
  assert.deepEqual(engine.recordTebexVerification(input), first);
  assert.throws(() => engine.recordTebexVerification({ ...input, subjectId: 'other', sourceEvidence: { eventId: 'changed' } }), /different verification evidence/);
});

test('manual review flags do not change entitlement automatically', () => {
  const engine = createCommerceEngine({ authorization });
  engine.recordTebexVerification({ actor: integration, transactionId: 't-3', subjectId: 'user-3', productIds: ['product-c'], amountCents: 2500, status: 'verified' });
  const flag = engine.createFraudFlag({ actor: staff, transactionId: 't-3', reason: 'Needs duplicate-order review', severity: 'high' });
  assert.equal(flag.status, 'open');
  assert.equal(engine.hasEntitlement('customer_support', 'user-3', 'product-c'), true);
  engine.resolveFraudFlag({ actor: staff, flagId: flag.id, resolution: 'Reviewed and cleared' });
  assert.equal(engine.openFraudFlags('customer_support').length, 0);
});

test('missing entitlement denies gated support', () => {
  const engine = createCommerceEngine({ authorization });
  const access = engine.supportAccess({ tenantId: 'customer_support', subjectId: 'unknown', productId: 'product-z' });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'entitlement_required');
});

test('transaction records remain tenant isolated', () => {
  const engine = createCommerceEngine({ authorization });
  engine.recordTebexVerification({ actor: integration, transactionId: 't-4', subjectId: 'user-4', productIds: ['product-d'], amountCents: 1000, status: 'verified' });
  assert.throws(() => engine.transaction('beverly_hills_rp', 't-4'), /Unknown transaction/);
});
