import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_MODULE_KEYS,
  MODULE_BY_KEY,
  approvalGatedModules,
  defaultModuleState,
  disableModule,
  enableModule,
  fullSuiteModuleState,
  validateModuleState,
} from '../src/platform/modules.mjs';

test('full suite enables every registered module except mandatory high-impact defaults', () => {
  const state = validateModuleState(fullSuiteModuleState());
  assert.equal(Object.keys(state).length, ALL_MODULE_KEYS.length);
  assert.ok(ALL_MODULE_KEYS.length > 40);
  for (const key of ALL_MODULE_KEYS) {
    if (key === 'restart_control' || key === 'mass_unban') {
      assert.equal(state[key], false, `${key} must stay off in full suite`);
    } else {
      assert.equal(state[key], true);
    }
  }
});

test('enabling a module enables its dependencies recursively', () => {
  const state = enableModule(defaultModuleState(), 'ban_appeals');
  assert.equal(state.ban_appeals, true);
  assert.equal(state.tickets, true);
  assert.equal(state.ban_evidence, true);
  assert.equal(state.retention, true);
  assert.equal(state.audit, true);
  assert.equal(state.rbac, true);
});

test('disabling a required dependency fails closed', () => {
  const state = enableModule(defaultModuleState(), 'ai_ticket_agent');
  assert.throws(() => disableModule(state, 'tickets'), /depend on it/);
});

test('high-impact controls stay off by default and remain approval-gated when enabled', () => {
  assert.equal(defaultModuleState().restart_control, false);
  assert.equal(defaultModuleState().mass_unban, false);
  assert.equal(fullSuiteModuleState().restart_control, false);
  assert.equal(fullSuiteModuleState().mass_unban, false);
  assert.equal(MODULE_BY_KEY.mass_unban.risk, 'high');
  assert.equal(MODULE_BY_KEY.restart_control.risk, 'high');
  assert.equal(MODULE_BY_KEY.mass_unban.approvalRequired, true);
  assert.equal(MODULE_BY_KEY.restart_control.approvalRequired, true);

  const enabled = enableModule(enableModule(fullSuiteModuleState(), 'mass_unban'), 'restart_control');
  const gated = approvalGatedModules(enabled);
  assert.ok(gated.includes('mass_unban'));
  assert.ok(gated.includes('restart_control'));
  assert.ok(gated.includes('backups'));
});

test('unknown module settings are rejected', () => {
  assert.throws(() => validateModuleState({ ...defaultModuleState(), definitely_not_real: true }), /Unknown Discord module/);
});
