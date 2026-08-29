import test from 'node:test';
import assert from 'node:assert/strict';
import { createFiveMOpsEngine } from '../src/platform/fivem-ops.mjs';
import { clearTenantModuleOverrides, enableTenantModule } from '../src/platform/tenants.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

const authorization = {
  beverly_hills_rp: { canonicalRoleIds: { staff: 'bh-staff', integration: 'bh-integration', owner: 'bh-owner' } },
  blood_diamond_rp: { canonicalRoleIds: { staff: 'bd-staff', integration: 'bd-integration', owner: 'bd-owner' } },
};

const identity = createTestIdentityAdapter();
const bhStaff = bindActor(identity, 'beverly_hills_rp', 'bh-admin', ['bh-staff']);
const bdStaff = bindActor(identity, 'blood_diamond_rp', 'bd-admin', ['bd-staff']);
const bhIntegration = bindActor(identity, 'beverly_hills_rp', 'relay', ['bh-integration']);

test('server status stays isolated per FiveM tenant', () => {
  const engine = createFiveMOpsEngine({ authorization });
  engine.updateServerStatus({ actor: bhIntegration, status: 'online', players: 25, maxPlayers: 64, queue: 3 });
  assert.equal(engine.getServerStatus('beverly_hills_rp').players, 25);
  assert.equal(engine.getServerStatus('blood_diamond_rp').status, 'unknown');
});

test('restart notices and statistic state are data-only integration outputs', () => {
  const engine = createFiveMOpsEngine({ authorization });
  const notice = engine.recordRestartNotice({ actor: bhIntegration, scheduledFor: '2026-08-09T10:00:00Z', countdownMinutes: 15, reason: 'scheduled maintenance' });
  assert.equal(notice.tenantId, 'beverly_hills_rp');
  const stat = engine.setStatisticChannelState({ actor: bhIntegration, channelKey: 'players', desiredName: 'Players: 25/64', value: '25/64' });
  assert.equal(stat.desiredName, 'Players: 25/64');
});

test('ban evidence cases cannot be accessed through another tenant key', () => {
  const engine = createFiveMOpsEngine({ authorization });
  const evidenceCase = engine.createBanEvidenceCase({ actor: bhStaff, banRef: 'ban-100', subjectId: 'player-1', reason: 'cheating evidence review' });
  const evidence = engine.addBanEvidence({ actor: bhStaff, caseId: evidenceCase.id, kind: 'screenshot', reference: 'discord-attachment-1', summary: 'Visible menu overlay' });
  assert.equal(evidence.tenantId, 'beverly_hills_rp');
  assert.throws(() => engine.addBanEvidence({ actor: bdStaff, caseId: evidenceCase.id, kind: 'note', reference: 'x' }), /Unknown ban evidence case/);
});

test('staff sits, duty, and incidents are tenant scoped', () => {
  const engine = createFiveMOpsEngine({ authorization });
  const duty = engine.setDuty({ actor: bdStaff, onDuty: true, now: '2026-08-09T07:00:00Z' });
  assert.equal(duty.onDuty, true);
  const sit = engine.recordSit({ actor: bdStaff, subjectId: 'player-2', category: 'report', outcome: 'resolved' });
  assert.equal(sit.tenantId, 'blood_diamond_rp');
  const incident = engine.createIncident({ actor: bdStaff, title: 'Inventory outage', severity: 'high', affectedResources: ['ox_inventory'] });
  engine.addIncidentEvent({ actor: bdStaff, incidentId: incident.id, type: 'log_snapshot', summary: 'Captured startup errors' });
  const closed = engine.closeIncident({ actor: bdStaff, incidentId: incident.id, postmortem: 'Dependency restored after validation' });
  assert.equal(closed.status, 'closed');
  assert.equal(engine.listTenantIncidents('beverly_hills_rp').length, 0);
  assert.equal(engine.listTenantIncidents('blood_diamond_rp').length, 1);
});

test('production restart control remains planning-only and off until explicitly enabled', () => {
  clearTenantModuleOverrides();
  const engine = createFiveMOpsEngine({ authorization });
  assert.throws(() => engine.planProductionRestart({ actor: bhStaff, reason: 'maintenance', approvalId: 'approval-123' }), /disabled/);

  enableTenantModule('beverly_hills_rp', 'restart_control');
  try {
    const plan = engine.planProductionRestart({ actor: bhStaff, reason: 'maintenance', approvalId: 'approval-123' });
    assert.equal(plan.executionDisabled, true);
    assert.equal(plan.status, 'planned_only');
    assert.equal(typeof engine.executeRestart, 'undefined');
  } finally {
    clearTenantModuleOverrides();
  }
});

test('role-name lookalikes and unverified actors fail closed', () => {
  const engine = createFiveMOpsEngine({ authorization });
  const fake = bindActor(identity, 'beverly_hills_rp', 'fake', ['Pixel Staff']);
  assert.throws(() => engine.createIncident({ actor: fake, title: 'fake' }), /Authorization denied/);
  assert.throws(() => engine.createIncident({
    actor: { userId: 'spoof', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] },
    title: 'spoof',
  }), /Unverified Discord identity/);
});
