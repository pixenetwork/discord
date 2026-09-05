import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityUtilitiesEngine } from '../src/platform/community-utilities.mjs';
import { MODULE_BY_KEY } from '../src/platform/modules.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: {
      staff: 'bh-staff',
      admin: 'bh-admin',
      owner: 'bh-owner',
    },
  },
  blood_diamond_rp: {
    canonicalRoleIds: {
      staff: 'bd-staff',
      admin: 'bd-admin',
      owner: 'bd-owner',
    },
  },
};

const identity = createTestIdentityAdapter();

function actor(tenantId, userId, roleIds = []) {
  return bindActor(identity, tenantId, userId, roleIds);
}

test('sticky/keyword/welcome/booster/polls/translation states are tenant-scoped and auditable', () => {
  const engine = createCommunityUtilitiesEngine({ authorization });
  const staff = actor('beverly_hills_rp', 'bh-staff-1', ['bh-staff']);

  const sticky = engine.upsertStickyMessage({ actor: staff, channelId: 'chan-1', content: 'Use /help first', now: '2026-08-09T09:00:00Z' });
  assert.equal(sticky.tenantId, 'beverly_hills_rp');

  const keyword = engine.upsertKeywordResponse({ actor: staff, keyword: 'lag', response: 'Please attach screenshot', exactMatch: false });
  assert.equal(keyword.keyword, 'lag');

  const welcome = engine.setWelcomeResponder({ actor: staff, enabled: true, channelId: 'welcome', template: 'Welcome {user}' });
  assert.equal(welcome.enabled, true);

  const booster = engine.setBoosterResponder({ actor: staff, enabled: true, template: 'Thanks for boosting!' });
  assert.equal(booster.tenantId, 'beverly_hills_rp');

  const poll = engine.createPoll({ actor: staff, question: 'Restart now?', options: ['Yes', 'No'] });
  assert.equal(poll.status, 'open');
  const closed = engine.closePoll({ actor: staff, pollId: poll.id, now: '2026-08-09T10:00:00Z' });
  assert.equal(closed.status, 'closed');

  const translation = engine.createTranslationRequest({
    actor: actor('beverly_hills_rp', 'member-1', []),
    sourceText: 'Hola',
    sourceLanguage: 'es',
    targetLanguage: 'en',
  });
  const reviewed = engine.reviewTranslationRequest({
    actor: staff,
    requestId: translation.id,
    status: 'completed',
    translatedText: 'Hello',
    reason: 'verified',
  });
  assert.equal(reviewed.status, 'completed');
  assert.equal(reviewed.translatedText, 'Hello');

  const snapshot = engine.snapshot({ actor: staff });
  assert.equal(snapshot.auditTrail.length >= 7, true);
  assert.equal(snapshot.translationRequests[0].tenantId, 'beverly_hills_rp');
});

test('vanity/sticky/auto role policy mutations are approval-aware and tenant-scoped', () => {
  const engine = createCommunityUtilitiesEngine({ authorization, requireRoleMutationApproval: true });
  const staff = actor('beverly_hills_rp', 'bh-staff-1', ['bh-staff']);
  const owner = actor('beverly_hills_rp', 'bh-owner-1', ['bh-owner']);

  const mutation = engine.proposeRolePolicyMutation({
    actor: staff,
    policyType: 'auto',
    roleIds: ['auto-role-1', 'auto-role-2'],
    now: '2026-08-09T11:00:00Z',
  });
  assert.equal(mutation.status, 'pending_approval');

  assert.throws(() => engine.reviewRolePolicyMutation({
    actor: actor('blood_diamond_rp', 'bd-owner-1', ['bd-owner']),
    mutationId: mutation.id,
    decision: 'approved',
  }), /Cross-tenant access denied/);

  const approved = engine.reviewRolePolicyMutation({
    actor: owner,
    mutationId: mutation.id,
    decision: 'approved',
    reason: 'approved for deployment',
  });
  assert.equal(approved.status, 'approved');

  const snapshot = engine.snapshot({ actor: staff });
  assert.deepEqual(snapshot.rolePolicies.auto, ['auto-role-1', 'auto-role-2']);
});

test('staff feedback and status-blacklist review records preserve reviewer history', () => {
  const engine = createCommunityUtilitiesEngine({ authorization });
  const staff = actor('beverly_hills_rp', 'bh-staff-1', ['bh-staff']);

  const feedback = engine.submitStaffFeedback({
    actor: actor('beverly_hills_rp', 'member-9', []),
    targetUserId: 'staff-target',
    comment: 'Handled the issue quickly',
    rating: 5,
  });
  const reviewedFeedback = engine.reviewStaffFeedback({
    actor: staff,
    feedbackId: feedback.id,
    decision: 'acknowledged',
    reason: 'noted in monthly review',
  });
  assert.equal(reviewedFeedback.reviews.length, 1);
  assert.equal(reviewedFeedback.reviews[0].reviewerId, 'bh-staff-1');

  const review = engine.createStatusBlacklistReview({
    actor: staff,
    memberId: 'member-22',
    statusText: 'scam links in bio',
  });
  const resolved = engine.resolveStatusBlacklistReview({
    actor: staff,
    reviewId: review.id,
    decision: 'remove_status',
    reason: 'contains prohibited phrase',
  });
  assert.equal(resolved.state, 'closed');
  assert.equal(resolved.decision, 'remove_status');
});

test('mass-unban stays disabled and remains approval-gated in the registry', () => {
  assert.equal(MODULE_BY_KEY.mass_unban.approvalRequired, true);
  assert.throws(() => createCommunityUtilitiesEngine({ authorization }).planMassUnban({
    actor: actor('beverly_hills_rp', 'bh-owner-1', ['bh-owner']),
    scope: 'legacy-false-positives',
    reason: 'manual review complete',
  }), /disabled/);
});

test('canonical-role authorization fails closed for privileged actions', () => {
  const engine = createCommunityUtilitiesEngine({
    authorization: {
      beverly_hills_rp: {
        canonicalRoleIds: { staff: 'bh-staff' },
      },
    },
  });

  assert.throws(() => engine.upsertStickyMessage({
    actor: actor('beverly_hills_rp', 'outsider', ['not-staff']),
    channelId: 'chan-2',
    content: 'rules',
  }), /Authorization denied/);

  assert.throws(() => engine.reviewRolePolicyMutation({
    actor: actor('beverly_hills_rp', 'bh-staff-1', ['bh-staff']),
    mutationId: 'role_mutation_1',
    decision: 'approved',
  }), /Missing canonical role IDs/);
});

test('privileged community snapshot reads require verified actor and canonical roles', () => {
  const engine = createCommunityUtilitiesEngine({ authorization });
  const staff = actor('beverly_hills_rp', 'bh-staff-1', ['bh-staff']);
  engine.upsertStickyMessage({ actor: staff, channelId: 'chan-read', content: 'rules', now: '2026-08-09T12:00:00Z' });

  const allowed = engine.snapshot({ actor: staff });
  assert.equal(allowed.tenantId, 'beverly_hills_rp');
  assert.equal(allowed.stickyMessages.length, 1);

  const emptyRoles = actor('beverly_hills_rp', 'empty', []);
  const lookalike = actor('beverly_hills_rp', 'lookalike', ['Staff', 'bh-staff-lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.snapshot({ actor: denied }), /Authorization denied/);
  }
  assert.throws(() => engine.snapshot({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
  }), /Unverified Discord identity/);

  const crossTenant = engine.snapshot({ actor: actor('blood_diamond_rp', 'bd-staff-1', ['bd-staff']) });
  assert.equal(crossTenant.tenantId, 'blood_diamond_rp');
  assert.equal(crossTenant.stickyMessages.length, 0);
  assert.equal(crossTenant.auditTrail.length, 0);
});
