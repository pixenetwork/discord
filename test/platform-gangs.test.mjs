import test from 'node:test';
import assert from 'node:assert/strict';
import { createGangEngine } from '../src/platform/gangs.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: { staff: 'bh-staff' },
  },
  blood_diamond_rp: {
    canonicalRoleIds: { staff: 'bd-staff' },
  },
};

const identity = createTestIdentityAdapter();

function staff(tenantId) {
  return bindActor(
    identity,
    tenantId,
    `${tenantId}-admin`,
    [tenantId === 'beverly_hills_rp' ? 'bh-staff' : 'bd-staff'],
  );
}

test('gang membership respects purchased slots and ownership transfer rules', () => {
  const engine = createGangEngine({ authorization });
  const actor = staff('beverly_hills_rp');
  const gang = engine.createGang({ actor, gangId: 'ballas', name: 'Ballas', ownerId: 'owner-1', purchasedSlots: 2 });
  assert.equal(gang.tenantId, 'beverly_hills_rp');
  engine.addMember({ actor, gangId: 'ballas', memberId: 'member-2' });
  assert.throws(() => engine.addMember({ actor, gangId: 'ballas', memberId: 'member-3' }), /slot limit/);
  assert.throws(() => engine.removeMember({ actor, gangId: 'ballas', memberId: 'owner-1' }), /Transfer ownership/);
  const transferred = engine.transferOwner({ actor, gangId: 'ballas', ownerId: 'member-2' });
  assert.equal(transferred.ownerId, 'member-2');
  const afterRemoval = engine.removeMember({ actor, gangId: 'ballas', memberId: 'owner-1' });
  assert.deepEqual(afterRemoval.memberIds, ['member-2']);
});

test('gang records fail closed across Beverly Hills and Blood Diamond tenants', () => {
  const engine = createGangEngine({ authorization });
  engine.createGang({ actor: staff('beverly_hills_rp'), gangId: 'families', ownerId: 'bh-owner' });
  assert.throws(
    () => engine.addMember({ actor: staff('blood_diamond_rp'), gangId: 'families', memberId: 'bd-user' }),
    /Cross-tenant access denied/,
  );
  assert.throws(() => engine.getGang({ actor: staff('blood_diamond_rp'), gangId: 'families' }), /Unknown gang/);
});

test('canonical role IDs are required and role-name lookalikes do not authorize', () => {
  const engine = createGangEngine({ authorization });
  const fake = bindActor(identity, 'beverly_hills_rp', 'fake-staff', ['Aquaphoria Staff', 'Pixel Staff']);
  assert.throws(() => engine.createGang({ actor: fake, gangId: 'fake', ownerId: 'x' }), /Authorization denied/);
  assert.throws(() => engine.createGang({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
    gangId: 'spoof',
    ownerId: 'x',
  }), /Unverified Discord identity/);
});

test('priority changes produce a tenant-scoped role sync plan without mutating Discord roles', () => {
  const engine = createGangEngine({
    authorization,
    priorityTiers: {
      none: { rank: 0, roleId: null },
      gold: { rank: 30, roleId: 'bh-priority-gold' },
    },
  });
  const actor = staff('beverly_hills_rp');
  engine.createGang({ actor, gangId: 'vagos', ownerId: 'owner', purchasedSlots: 3 });
  engine.addMember({ actor, gangId: 'vagos', memberId: 'member' });
  engine.setPriorityTier({ actor, gangId: 'vagos', tier: 'gold' });
  const plan = engine.roleSyncPlan({ actor, gangId: 'vagos' });
  assert.equal(plan.priorityRoleId, 'bh-priority-gold');
  assert.deepEqual(plan.memberIds, ['owner', 'member']);
  assert.equal(plan.tenantId, 'beverly_hills_rp');
});

test('gang strikes retain history and resolve idempotently', () => {
  const engine = createGangEngine({ authorization });
  const actor = staff('blood_diamond_rp');
  engine.createGang({ actor, gangId: 'lost-mc', ownerId: 'owner' });
  const strike = engine.addStrike({ actor, gangId: 'lost-mc', reason: 'Repeated rule violation', points: 2, now: '2026-08-09T07:00:00Z' });
  assert.equal(strike.points, 2);
  const resolved = engine.resolveStrike({ actor, gangId: 'lost-mc', strikeId: strike.id, resolution: 'Served suspension', now: '2026-08-09T08:00:00Z' });
  assert.equal(resolved.resolution, 'Served suspension');
  const duplicate = engine.resolveStrike({ actor, gangId: 'lost-mc', strikeId: strike.id, resolution: 'ignored later change', now: '2026-08-09T09:00:00Z' });
  assert.equal(duplicate.resolution, 'Served suspension');
  const gang = engine.getGang({ actor, gangId: 'lost-mc' });
  assert.deepEqual(gang.activeStrikeIds, []);
  assert.equal(gang.strikes.length, 1);
});

test('privileged gang reads require verified actor and canonical roles', () => {
  const engine = createGangEngine({ authorization });
  const actor = staff('beverly_hills_rp');
  engine.createGang({ actor, gangId: 'read-gang', ownerId: 'owner' });

  const emptyRoles = bindActor(identity, 'beverly_hills_rp', 'empty', []);
  const lookalike = bindActor(identity, 'beverly_hills_rp', 'lookalike', ['Staff', 'bh-staff-lookalike']);
  for (const denied of [emptyRoles, lookalike]) {
    assert.throws(() => engine.getGang({ actor: denied, gangId: 'read-gang' }), /Authorization denied/);
    assert.throws(() => engine.roleSyncPlan({ actor: denied, gangId: 'read-gang' }), /Authorization denied/);
  }
  assert.throws(() => engine.getGang({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
    gangId: 'read-gang',
  }), /Unverified Discord identity/);
  assert.throws(() => engine.getGang({ actor: staff('blood_diamond_rp'), gangId: 'read-gang' }), /Unknown gang|Cross-tenant/);
});
