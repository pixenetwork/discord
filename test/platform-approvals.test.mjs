import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalEngine } from '../src/platform/approvals.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: { canonicalRoleIds: { owner: 'bh-owner', admin: 'bh-admin', staff: 'bh-staff' } },
  blood_diamond_rp: { canonicalRoleIds: { owner: 'bd-owner', admin: 'bd-admin', staff: 'bd-staff' } },
};

const identity = createTestIdentityAdapter();
const bhStaff = bindActor(identity, 'beverly_hills_rp', 'requester', ['bh-staff']);
const bhOwner = bindActor(identity, 'beverly_hills_rp', 'owner-user', ['bh-owner']);
const bdOwner = bindActor(identity, 'blood_diamond_rp', 'bd-owner-user', ['bd-owner']);

test('approval-gated backups require a different authorized person and are single-use', () => {
  const engine = createApprovalEngine({ authorization });
  const payload = { backupId: 'safe-backup', reason: 'restore drill' };
  const request = engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload,
    now: '2026-08-09T07:00:00Z',
  });

  assert.throws(
    () => engine.approve({ actor: bindActor(identity, 'beverly_hills_rp', 'requester', ['bh-admin']), approvalId: request.id, now: '2026-08-09T07:01:00Z' }),
    /second person/,
  );

  const approved = engine.approve({ actor: bhOwner, approvalId: request.id, reason: 'restore confirmed', now: '2026-08-09T07:02:00Z' });
  assert.equal(approved.status, 'approved');

  const consumed = engine.consume({ actor: bhStaff, approvalId: request.id, moduleKey: 'backups', action: 'restore_state', payload, now: '2026-08-09T07:03:00Z' });
  assert.ok(consumed.consumedAt);
  assert.throws(() => engine.consume({ actor: bhStaff, approvalId: request.id, payload }), /already consumed/);
});

test('approval scope is bound to exact payload, module, action, and tenant', () => {
  const engine = createApprovalEngine({ authorization });
  const request = engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'b-1' },
  });
  assert.throws(() => engine.approve({ actor: bdOwner, approvalId: request.id }), /Cross-tenant/);
  engine.approve({ actor: bhOwner, approvalId: request.id });
  assert.throws(
    () => engine.consume({ actor: bhStaff, approvalId: request.id, payload: { backupId: 'b-2' } }),
    /payload does not match/,
  );
  assert.throws(
    () => engine.consume({ actor: bhStaff, approvalId: request.id, moduleKey: 'mass_unban', action: 'restore_state', payload: { backupId: 'b-1' } }),
    /scope does not match/,
  );
});

test('pending approvals expire fail-closed', () => {
  const engine = createApprovalEngine({ authorization, defaultTtlMs: 60_000 });
  const request = engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'safe-backup' },
    now: '2026-08-09T07:00:00Z',
  });
  const expired = engine.get({ actor: bhStaff, approvalId: request.id, now: '2026-08-09T07:01:01Z' });
  assert.equal(expired.status, 'expired');
  assert.throws(() => engine.approve({ actor: bhOwner, approvalId: request.id, now: '2026-08-09T07:01:02Z' }), /already expired/);
});

test('privileged approval reads require verified actor and canonical roles', () => {
  const engine = createApprovalEngine({ authorization });
  const request = engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'read-me' },
  });
  assert.equal(engine.pending({ actor: bhStaff }).length, 1);
  assert.equal(engine.get({ actor: bhStaff, approvalId: request.id }).id, request.id);

  const emptyRoles = bindActor(identity, 'beverly_hills_rp', 'empty-read', []);
  const lookalike = bindActor(identity, 'beverly_hills_rp', 'lookalike-read', ['Owner', 'bh-owner-lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.get({ actor: denied, approvalId: request.id }), /Authorization denied/);
    assert.throws(() => engine.pending({ actor: denied }), /Authorization denied/);
  }
  assert.throws(() => engine.get({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
    approvalId: request.id,
  }), /Unverified Discord identity/);
  assert.throws(() => engine.get({ actor: bdOwner, approvalId: request.id }), /Cross-tenant access denied/);
  assert.equal(engine.pending({ actor: bdOwner }).length, 0);
});

test('non approval-gated modules cannot create approval theater', () => {
  const engine = createApprovalEngine({ authorization });
  assert.throws(
    () => engine.request({ actor: bhStaff, moduleKey: 'tickets', action: 'close_ticket', payload: { ticketId: '1' } }),
    /not approval-gated/,
  );
});

test('restart_control and mass_unban stay disabled; empty roleIds cannot open backups', () => {
  const engine = createApprovalEngine({ authorization });
  assert.throws(() => engine.request({
    actor: bhStaff,
    moduleKey: 'restart_control',
    action: 'restart_server',
    payload: { server: 'bh' },
  }), /disabled/);
  assert.throws(() => engine.request({
    actor: bhStaff,
    moduleKey: 'mass_unban',
    action: 'bulk_unban',
    payload: { ids: ['1'] },
  }), /disabled/);

  const emptyRoles = bindActor(identity, 'beverly_hills_rp', 'empty', []);
  const lookalike = bindActor(identity, 'beverly_hills_rp', 'fake', ['Owner', 'bh-owner-lookalike']);

  for (const moduleKey of ['restart_control', 'mass_unban', 'backups']) {
    assert.throws(() => engine.request({
      actor: emptyRoles,
      moduleKey,
      action: 'dangerous',
      payload: { moduleKey },
    }), /Authorization denied/);
    assert.throws(() => engine.request({
      actor: lookalike,
      moduleKey,
      action: 'dangerous',
      payload: { moduleKey },
    }), /Authorization denied/);
  }

  const request = engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'b1' },
  });
  engine.approve({ actor: bhOwner, approvalId: request.id });
  assert.throws(() => engine.consume({
    actor: emptyRoles,
    approvalId: request.id,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'b1' },
  }), /Authorization denied/);
  assert.throws(() => engine.consume({
    actor: lookalike,
    approvalId: request.id,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { backupId: 'b1' },
  }), /Authorization denied/);
});

test('missing canonical role configuration fails closed for request and consume', () => {
  const engine = createApprovalEngine({ authorization: { beverly_hills_rp: {} } });
  assert.throws(() => engine.request({
    actor: bhStaff,
    moduleKey: 'backups',
    action: 'restore_state',
    payload: { x: 1 },
  }), /Missing canonical role configuration/);
});

test('unverified actor bags are rejected', () => {
  const engine = createApprovalEngine({ authorization });
  assert.throws(() => engine.request({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
    moduleKey: 'backups',
    action: 'restore_state',
    payload: {},
  }), /Unverified Discord identity/);
});
