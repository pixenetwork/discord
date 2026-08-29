import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalEngine } from '../src/platform/approvals.mjs';
import {
  clearTenantModuleOverrides,
  enableTenantModule,
} from '../src/platform/tenants.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: { canonicalRoleIds: { owner: 'bh-owner', admin: 'bh-admin', staff: 'bh-staff' } },
  blood_diamond_rp: { canonicalRoleIds: { owner: 'bd-owner', admin: 'bd-admin', staff: 'bd-staff' } },
};

const identity = createTestIdentityAdapter();
const bhStaff = bindActor(identity, 'beverly_hills_rp', 'requester', ['bh-staff']);
const bhOwner = bindActor(identity, 'beverly_hills_rp', 'owner-user', ['bh-owner']);
const bhAdmin = bindActor(identity, 'beverly_hills_rp', 'admin-user', ['bh-admin']);
const bdOwner = bindActor(identity, 'blood_diamond_rp', 'bd-owner-user', ['bd-owner']);

function withHighImpactEnabled(fn) {
  clearTenantModuleOverrides();
  enableTenantModule('beverly_hills_rp', 'restart_control');
  enableTenantModule('beverly_hills_rp', 'mass_unban');
  try {
    return fn();
  } finally {
    clearTenantModuleOverrides();
  }
}

test('high-impact approval requires a different authorized person and is single-use', () => {
  withHighImpactEnabled(() => {
    const engine = createApprovalEngine({ authorization });
    const payload = { server: 'bh', reason: 'scheduled maintenance' };
    const request = engine.request({
      actor: bhStaff,
      moduleKey: 'restart_control',
      action: 'restart_server',
      payload,
      now: '2026-08-09T07:00:00Z',
    });

    assert.throws(
      () => engine.approve({ actor: bindActor(identity, 'beverly_hills_rp', 'requester', ['bh-admin']), approvalId: request.id, now: '2026-08-09T07:01:00Z' }),
      /second person/,
    );

    const approved = engine.approve({ actor: bhOwner, approvalId: request.id, reason: 'maintenance confirmed', now: '2026-08-09T07:02:00Z' });
    assert.equal(approved.status, 'approved');

    const consumed = engine.consume({ actor: bhStaff, approvalId: request.id, moduleKey: 'restart_control', action: 'restart_server', payload, now: '2026-08-09T07:03:00Z' });
    assert.ok(consumed.consumedAt);
    assert.throws(() => engine.consume({ actor: bhStaff, approvalId: request.id, payload }), /already consumed/);
  });
});

test('approval scope is bound to exact payload, module, action, and tenant', () => {
  withHighImpactEnabled(() => {
    const engine = createApprovalEngine({ authorization });
    const request = engine.request({
      actor: bhStaff,
      moduleKey: 'mass_unban',
      action: 'bulk_unban',
      payload: { ids: ['1', '2'] },
    });
    assert.throws(() => engine.approve({ actor: bdOwner, approvalId: request.id }), /Cross-tenant/);
    engine.approve({ actor: bhOwner, approvalId: request.id });
    assert.throws(
      () => engine.consume({ actor: bhStaff, approvalId: request.id, payload: { ids: ['1', '2', '3'] } }),
      /payload does not match/,
    );
    assert.throws(
      () => engine.consume({ actor: bhStaff, approvalId: request.id, moduleKey: 'restart_control', action: 'bulk_unban', payload: { ids: ['1', '2'] } }),
      /scope does not match/,
    );
  });
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
  const expired = engine.get('beverly_hills_rp', request.id, '2026-08-09T07:01:01Z');
  assert.equal(expired.status, 'expired');
  assert.throws(() => engine.approve({ actor: bhOwner, approvalId: request.id, now: '2026-08-09T07:01:02Z' }), /already expired/);
});

test('non approval-gated modules cannot create approval theater', () => {
  const engine = createApprovalEngine({ authorization });
  assert.throws(
    () => engine.request({ actor: bhStaff, moduleKey: 'tickets', action: 'close_ticket', payload: { ticketId: '1' } }),
    /not approval-gated/,
  );
});

test('empty roleIds and lookalike role names cannot open or consume high-impact gates', () => {
  withHighImpactEnabled(() => {
    const engine = createApprovalEngine({ authorization });
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
});

test('missing canonical role configuration fails closed for request and consume', () => {
  withHighImpactEnabled(() => {
    const engine = createApprovalEngine({ authorization: { beverly_hills_rp: {} } });
    assert.throws(() => engine.request({
      actor: bhStaff,
      moduleKey: 'restart_control',
      action: 'restart_server',
      payload: { x: 1 },
    }), /Missing canonical role configuration/);
  });
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
