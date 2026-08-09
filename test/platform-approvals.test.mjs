import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalEngine } from '../src/platform/approvals.mjs';

const authorization = {
  beverly_hills_rp: { canonicalRoleIds: { owner: 'bh-owner', admin: 'bh-admin' } },
  blood_diamond_rp: { canonicalRoleIds: { owner: 'bd-owner', admin: 'bd-admin' } },
};

const bhRequester = { userId: 'requester', tenantId: 'beverly_hills_rp', roleIds: [] };
const bhOwner = { userId: 'owner-user', tenantId: 'beverly_hills_rp', roleIds: ['bh-owner'] };
const bdOwner = { userId: 'bd-owner-user', tenantId: 'blood_diamond_rp', roleIds: ['bd-owner'] };

test('high-impact approval requires a different authorized person and is single-use', () => {
  const engine = createApprovalEngine({ authorization });
  const payload = { server: 'bh', reason: 'scheduled maintenance' };
  const request = engine.request({
    actor: bhRequester,
    moduleKey: 'restart_control',
    action: 'restart_server',
    payload,
    now: '2026-08-09T07:00:00Z',
  });

  assert.throws(
    () => engine.approve({ actor: { ...bhRequester, roleIds: ['bh-admin'] }, approvalId: request.id, now: '2026-08-09T07:01:00Z' }),
    /second person/,
  );

  const approved = engine.approve({ actor: bhOwner, approvalId: request.id, reason: 'maintenance confirmed', now: '2026-08-09T07:02:00Z' });
  assert.equal(approved.status, 'approved');

  const consumed = engine.consume({ actor: bhRequester, approvalId: request.id, moduleKey: 'restart_control', action: 'restart_server', payload, now: '2026-08-09T07:03:00Z' });
  assert.ok(consumed.consumedAt);
  assert.throws(() => engine.consume({ actor: bhRequester, approvalId: request.id, payload }), /already consumed/);
});

test('approval scope is bound to exact payload, module, action, and tenant', () => {
  const engine = createApprovalEngine({ authorization });
  const request = engine.request({
    actor: bhRequester,
    moduleKey: 'mass_unban',
    action: 'bulk_unban',
    payload: { ids: ['1', '2'] },
  });
  assert.throws(() => engine.approve({ actor: bdOwner, approvalId: request.id }), /Cross-tenant/);
  engine.approve({ actor: bhOwner, approvalId: request.id });
  assert.throws(
    () => engine.consume({ actor: bhRequester, approvalId: request.id, payload: { ids: ['1', '2', '3'] } }),
    /payload does not match/,
  );
  assert.throws(
    () => engine.consume({ actor: bhRequester, approvalId: request.id, moduleKey: 'restart_control', action: 'bulk_unban', payload: { ids: ['1', '2'] } }),
    /scope does not match/,
  );
});

test('pending approvals expire fail-closed', () => {
  const engine = createApprovalEngine({ authorization, defaultTtlMs: 60_000 });
  const request = engine.request({
    actor: bhRequester,
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
    () => engine.request({ actor: bhRequester, moduleKey: 'tickets', action: 'close_ticket', payload: { ticketId: '1' } }),
    /not approval-gated/,
  );
});
