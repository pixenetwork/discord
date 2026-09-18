import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationsEngine } from '../src/platform/applications.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: {
      staff: 'bhrp_staff',
      admin: 'bhrp_admin',
      owner: 'bhrp_owner',
    },
  },
  blood_diamond_rp: {
    canonicalRoleIds: {
      staff: 'bdrp_staff',
      admin: 'bdrp_admin',
      owner: 'bdrp_owner',
    },
  },
};

const identity = createTestIdentityAdapter();

const staff = (tenantId) => bindActor(
  identity,
  tenantId,
  `${tenantId}_staff`,
  [tenantId === 'beverly_hills_rp' ? 'bhrp_staff' : 'bdrp_staff'],
);

const admin = (tenantId) => bindActor(
  identity,
  tenantId,
  `${tenantId}_admin`,
  [tenantId === 'beverly_hills_rp' ? 'bhrp_admin' : 'bdrp_admin'],
);

const applicant = (tenantId, userId) => bindActor(identity, tenantId, userId, []);

test('tenant-scoped default and custom application definitions are configurable', () => {
  const engine = createApplicationsEngine({ authorization });
  const defaults = engine.applicationDefinitions({ actor: staff('beverly_hills_rp') });
  assert.deepEqual(defaults.map((entry) => entry.typeKey).sort(), ['custom', 'ems', 'mechanic', 'pd', 'staff']);

  const custom = engine.upsertApplicationDefinition({
    actor: staff('beverly_hills_rp'),
    typeKey: 'custom:judge',
    label: 'Judge Application',
    questions: ['Experience?', 'Timezone?'],
  });
  assert.equal(custom.tenantId, 'beverly_hills_rp');
  assert.equal(custom.typeKey, 'custom:judge');

  assert.equal(engine.applicationDefinitions({ actor: staff('blood_diamond_rp') }).some((entry) => entry.typeKey === 'custom:judge'), false);
});

test('submissions, reviewer decisions, reasons, and history remain tenant-scoped', () => {
  const engine = createApplicationsEngine({ authorization });
  const submission = engine.submitApplication({
    actor: applicant('beverly_hills_rp', 'applicant_1'),
    typeKey: 'staff',
    answers: { 'Why should we accept this application?': 'I can support late nights.' },
  });
  assert.equal(submission.tenantId, 'beverly_hills_rp');
  assert.equal(submission.status, 'submitted');
  assert.equal(submission.history.length, 1);

  const rejected = engine.reviewApplication({
    actor: staff('beverly_hills_rp'),
    submissionId: submission.id,
    decision: 'rejected',
    reason: 'Insufficient availability details',
  });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reviews.at(-1).reason, 'Insufficient availability details');
  assert.equal(rejected.history.at(-1).type, 'decision_recorded');

  assert.throws(() => engine.reviewApplication({
    actor: staff('blood_diamond_rp'),
    submissionId: submission.id,
    decision: 'approved',
  }), /Cross-tenant access denied/);
});

test('verification panels are tenant-scoped and include sticky/auto role policy state', () => {
  const engine = createApplicationsEngine({ authorization });
  const panel = engine.createVerificationPanel({
    actor: staff('beverly_hills_rp'),
    panelKey: 'citizen',
    title: 'Citizen Verification',
    stickyRoleIds: ['role_whitelisted'],
    autoRoleIds: ['role_member'],
  });
  assert.equal(panel.tenantId, 'beverly_hills_rp');
  assert.deepEqual(panel.stickyRoleIds, ['role_whitelisted']);
  assert.deepEqual(panel.autoRoleIds, ['role_member']);
  assert.equal(engine.snapshot({ actor: staff('blood_diamond_rp') }).verificationPanels.length, 0);
});

test('role assignment plans are approval-aware and do not mutate roles directly', () => {
  const engine = createApplicationsEngine({ authorization, requireRoleAssignmentApproval: true });
  const submission = engine.submitApplication({
    actor: applicant('beverly_hills_rp', 'applicant_2'),
    typeKey: 'pd',
    answers: { 'Why should we accept this application?': 'I have prior LEO RP experience.' },
  });

  engine.reviewApplication({
    actor: staff('beverly_hills_rp'),
    submissionId: submission.id,
    decision: 'approved',
  });

  const plan = engine.planRoleAssignment({
    actor: staff('beverly_hills_rp'),
    submissionId: submission.id,
    stickyRoleIds: ['role_pd_verified'],
    autoRoleIds: ['role_pd_probationary'],
  });
  assert.equal(plan.status, 'pending_approval');
  assert.equal(plan.executionMode, 'planned_only');

  const reviewed = engine.reviewRoleAssignmentPlan({
    actor: admin('beverly_hills_rp'),
    planId: plan.id,
    decision: 'approved',
    reason: 'Approved by command',
  });
  assert.equal(reviewed.status, 'approved');

  const storedSubmission = engine.snapshot({ actor: staff('beverly_hills_rp') }).submissions.find((entry) => entry.id === submission.id);
  assert.equal(storedSubmission.roleAssignmentPlanId, plan.id);
  assert.equal(storedSubmission.history.at(-1).type, 'role_assignment_reviewed');
});

test('privileged application reads require verified actor and canonical roles', () => {
  const engine = createApplicationsEngine({ authorization });
  engine.upsertApplicationDefinition({
    actor: staff('beverly_hills_rp'),
    typeKey: 'staff',
    questions: ['Why apply?'],
  });

  const emptyRoles = bindActor(identity, 'beverly_hills_rp', 'empty', []);
  const lookalike = bindActor(identity, 'beverly_hills_rp', 'lookalike', ['Staff', 'bhrp_staff_lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.applicationDefinitions({ actor: denied }), /Authorization denied/);
    assert.throws(() => engine.snapshot({ actor: denied }), /Authorization denied/);
  }
  assert.throws(() => engine.applicationDefinitions({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bhrp_staff'] },
  }), /Unverified Discord identity/);
  assert.throws(() => engine.snapshot({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bhrp_staff'] },
  }), /Unverified Discord identity/);
});

test('canonical-role authorization fails closed', () => {
  const engine = createApplicationsEngine({
    authorization: {
      beverly_hills_rp: { canonicalRoleIds: {} },
    },
  });

  assert.throws(() => engine.upsertApplicationDefinition({
    actor: bindActor(identity, 'beverly_hills_rp', 'staff_user', ['bhrp_staff']),
    typeKey: 'staff',
    questions: ['Availability?'],
  }), /Missing canonical role IDs/);
});
